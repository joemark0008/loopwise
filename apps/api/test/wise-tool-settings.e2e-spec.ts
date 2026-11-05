import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const SETTINGS = `query ($facilityId: ID) { wiseToolSettings(facilityId: $facilityId) {
	facilityId facilities { id name type isAdmin }
	tools { name kind category locked comingSoon facilityDefault facilityEnabled myEnabled enabled } } }`;
const SET_FACILITY = `mutation ($facilityId: ID!, $toolName: String!, $enabled: Boolean!) {
	setWiseToolEnabled(facilityId: $facilityId, toolName: $toolName, enabled: $enabled) }`;
const SET_MINE = `mutation ($toolName: String!, $enabled: Boolean!) {
	setMyWiseToolEnabled(toolName: $toolName, enabled: $enabled) }`;
const UPDATE_NOTE = `mutation ($input: UpdateEncounterNoteInput!) { updateEncounterNote(input: $input) { plan } }`;
const CANCEL = `mutation ($input: WiseOriginInput!) { cancelWiseProposal(input: $input) { status } }`;

/**
 * Wise tool settings (DESIGN.md §7.3) end to end: a tool a facility admin turns off is not offered to the model, the
 * system prompt says it is off, a call to it is refused, and a card drafted before the toggle can't be confirmed (but
 * can be cancelled). Users can turn tools off for themselves only; only admins change a facility; changes are audited.
 */
describe('Wise tool settings (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let facilityId = '';
	let patientId = '';
	let encounterId = '';
	const doctor = { cookie: [] as string[], id: '' };
	const admin = { cookie: [] as string[], id: '' };
	const model = {
		calls: 0,
		lastCall: null as LanguageModelV3CallOptions | null,
		toolName: 'propose_encounter_note',
		input: { plan: 'Recheck BP in 2 weeks.' } as Record<string, unknown>,
	};

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	/** One Wise turn in a new chart chat; the SSE events and the chat id. */
	const ask = async (text: string) => {
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ model: MODEL, message: { text }, ...(await newChatTarget()) })
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			});
		expect(res.status).toBe(200);
		const events = parseSse(res.body as string);
		return { events, chatId: events.find((event) => event.type === 'data-newChat')?.data.id as string };
	};

	/** A chart chat is one per clinician per patient: drop the previous one so each turn starts fresh. */
	const newChatTarget = async () => {
		await prisma.chat.deleteMany({ where: { userId: doctor.id } });
		return { patientId };
	};

	const offeredTools = () => (model.lastCall?.tools ?? []).map((tool) => tool.name);
	const systemPrompt = () =>
		model.lastCall?.prompt
			.filter((message) => message.role === 'system')
			.map((message) => message.content)
			.join('\n') ?? '';

	const tool = async (cookie: string[], name: string) =>
		((await graphql(cookie, SETTINGS, { facilityId })).body.data.wiseToolSettings.tools as { name: string }[]).find(
			(candidate) => candidate.name === name,
		);

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(model),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const head = await createTestUser(app, { name: 'Head Nurse', email: 'head@example.com', password });
		Object.assign(doctor, { cookie: reyes.cookie, id: reyes.userId });
		Object.assign(admin, { cookie: head.cookie, id: head.userId });
		clinicId = (await graphql(doctor.cookie, 'mutation { createClinic(input: { name: "Clinic" }) { id } }')).body
			.data.createClinic.id;
		const facility = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		facilityId = facility.id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilityId, userId: doctor.id, role: 'user' },
				{ orgId: facilityId, userId: admin.id, role: 'admin' },
			],
		});
		patientId = (
			await graphql(
				doctor.cookie,
				'mutation ($input: RegisterPatientInput!) { registerPatient(input: $input) { patient { id } } }',
				{
					input: {
						facilityId,
						givenName: 'Maria',
						familyName: 'Santos',
						birthDate: '1981-04-12',
						sex: 'female',
						consentGiven: true,
					},
				},
			)
		).body.data.registerPatient.patient.id;
		encounterId = (
			await graphql(
				doctor.cookie,
				'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
				{ input: { patientId, facilityId, reason: 'Fatigue' } },
			)
		).body.data.createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('lists every tool with the clinic defaults, and who administers the facility', async () => {
		const res = await graphql(doctor.cookie, SETTINGS);
		expect(res.body.errors).toBeUndefined();
		const settings = res.body.data.wiseToolSettings;
		expect(settings.facilities).toEqual([
			{ id: facilityId, name: 'Health Center', type: 'clinic', isAdmin: false },
		]);
		const byName = Object.fromEntries(settings.tools.map((entry: { name: string }) => [entry.name, entry]));
		expect(byName.propose_encounter_note).toMatchObject({ kind: 'propose', enabled: true, facilityEnabled: true });
		expect(byName.find_patient).toMatchObject({ locked: true, enabled: true });
		expect(byName.propose_referral).toMatchObject({ comingSoon: true, enabled: false });
	});

	it('lets only the facility’s admins change its tools, and audits each change', async () => {
		const refused = await graphql(doctor.cookie, SET_FACILITY, {
			facilityId,
			toolName: 'propose_encounter_note',
			enabled: false,
		});
		expect(refused.body.errors?.[0].message).toMatch(/admins/);

		const locked = await graphql(admin.cookie, SET_FACILITY, {
			facilityId,
			toolName: 'find_patient',
			enabled: false,
		});
		expect(locked.body.errors?.[0].message).toMatch(/can't be turned on or off/);

		const res = await graphql(admin.cookie, SET_FACILITY, {
			facilityId,
			toolName: 'propose_encounter_note',
			enabled: false,
		});
		expect(res.body.errors).toBeUndefined();
		expect(await tool(doctor.cookie, 'propose_encounter_note')).toMatchObject({
			facilityEnabled: false,
			enabled: false,
		});
		expect(
			await prisma.auditLog.findFirst({
				where: { action: 'wise_tool.disable', resourceId: 'propose_encounter_note' },
			}),
		).toMatchObject({ userId: admin.id, orgId: facilityId, patientId: null, resource: 'wise_tool' });
	});

	it('does not offer a turned-off tool to the model and says it is off in the system prompt', async () => {
		model.toolName = 'none';
		await ask('Change the plan to recheck BP in 2 weeks');
		expect(offeredTools()).not.toContain('propose_encounter_note');
		expect(offeredTools()).toContain('propose_encounter');
		expect(systemPrompt()).toContain('Turned off in Wise settings');
		expect(systemPrompt()).toContain('Edit a visit note');
	});

	it('refuses a call to the turned-off tool: no card is drafted', async () => {
		model.toolName = 'propose_encounter_note';
		const { events } = await ask('Change the plan to recheck BP in 2 weeks');
		expect(events.find((event) => event.type === 'tool-output-available')).toBeUndefined();
		expect(
			events.find((event) => event.type === 'tool-output-error' || event.type === 'tool-input-error'),
		).toBeTruthy();
	});

	it('refuses to confirm a card drafted before the tool was turned off, and still lets it be cancelled', async () => {
		await graphql(admin.cookie, SET_FACILITY, { facilityId, toolName: 'propose_encounter_note', enabled: true });
		model.toolName = 'propose_encounter_note';
		const { events, chatId } = await ask('Change the plan to recheck BP in 2 weeks');
		const card = events.find((event) => event.type === 'tool-output-available');
		expect(card).toBeTruthy();
		await graphql(admin.cookie, SET_FACILITY, { facilityId, toolName: 'propose_encounter_note', enabled: false });

		const origin = { chatId, toolCallId: card.toolCallId, toolName: 'propose_encounter_note', edited: false };
		const res = await graphql(doctor.cookie, UPDATE_NOTE, {
			input: { encounterId, reason: 'Fatigue', plan: 'Recheck BP in 2 weeks.', wiseOrigin: origin },
		});
		expect(res.body.errors?.[0].message).toMatch(/turned off in Wise settings/);
		expect((await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } })).plan).toBeNull();

		const cancelled = await graphql(doctor.cookie, CANCEL, { input: origin });
		expect(cancelled.body.errors).toBeUndefined();
		expect(cancelled.body.data.cancelWiseProposal.status).toBe('cancelled');
	});

	it('lets a user turn a tool off for themselves, but never on past their facility', async () => {
		await graphql(doctor.cookie, SET_MINE, { toolName: 'run_analytics_sql', enabled: false });
		expect(await tool(doctor.cookie, 'run_analytics_sql')).toMatchObject({ myEnabled: false, enabled: false });
		model.toolName = 'none';
		await ask('How many patients do I have?');
		expect(offeredTools()).not.toContain('run_analytics_sql');

		await graphql(doctor.cookie, SET_MINE, { toolName: 'propose_encounter_note', enabled: true });
		expect(await tool(doctor.cookie, 'propose_encounter_note')).toMatchObject({ enabled: false });
		// The admin's own settings are untouched by the doctor's.
		expect(await tool(admin.cookie, 'run_analytics_sql')).toMatchObject({ myEnabled: true });
	});
});

/** Calls `model.toolName` (unless 'none') on the first step of a turn, then answers in text. */
function scriptedModel(model: {
	calls: number;
	lastCall: LanguageModelV3CallOptions | null;
	toolName: string;
	input: Record<string, unknown>;
}): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const text = (delta: string): LanguageModelV3StreamPart[] => [
		{ type: 'text-start', id: 'text_1' },
		{ type: 'text-delta', id: 'text_1', delta },
		{ type: 'text-end', id: 'text_1' },
		{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
	];
	const mock = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Title' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async (options) => {
			model.calls += 1;
			const firstStep = !options.prompt.some((message) => message.role === 'tool');
			if (firstStep) {
				model.lastCall = options;
			}
			const parts: LanguageModelV3StreamPart[] =
				firstStep && model.toolName !== 'none'
					? [
							{
								type: 'tool-call',
								toolCallId: `settings_call_${model.calls}`,
								toolName: model.toolName,
								input: JSON.stringify(model.input),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: text('Done.');
			return {
				stream: new ReadableStream<LanguageModelV3StreamPart>({
					start(controller) {
						controller.enqueue({ type: 'stream-start', warnings: [] });
						parts.forEach((part) => controller.enqueue(part));
						controller.close();
					},
				}),
			};
		},
	});
	return { model: mock, providerOptions: {}, contextWindow: 128_000 } as unknown as ProviderModelResult;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE events of every type
function parseSse(body: string): any[] {
	return body
		.split('\n')
		.filter((line) => line.startsWith('data: {'))
		.map((line) => JSON.parse(line.slice('data: '.length)));
}
