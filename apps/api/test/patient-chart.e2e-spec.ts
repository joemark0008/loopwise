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
const ENCOUNTER_FIELDS = 'id reason notes sourceChatId facility { name } doctor { name }';
const CREATE_ENCOUNTER = `mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { ${ENCOUNTER_FIELDS} } }`;
const ENCOUNTERS = `query ($patientId: ID!) { encounters(patientId: $patientId) { ${ENCOUNTER_FIELDS} } }`;

/**
 * The patient chart (DESIGN.md §7): encounters under row-level security, and one Wise chat per clinician per patient
 * that knows the patient. The LLM is a scripted mock: it drafts an encounter with `propose_encounter`, then answers.
 */
describe('patient chart (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let chatId = '';
	const prompts: string[] = [];
	let toolCall: ScriptedToolCall = {
		toolName: 'propose_encounter',
		input: { reason: 'Fatigue follow-up', notes: 'BP 150/95.' },
	};
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
	};
	const facilities = { healthCenter: '', hospital: '' };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	const ask = (cookie: string[], body: Record<string, unknown>) =>
		request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ model: MODEL, ...body })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(prompts, () => toolCall),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		users.reyes = { cookie: reyes.cookie, id: reyes.userId };
		users.cruz = { cookie: cruz.cookie, id: cruz.userId };

		const clinic = await graphql(users.reyes.cookie, 'mutation { createClinic(input: { name: "Clinic" }) { id } }');
		clinicId = clinic.body.data.createClinic.id;
		await prisma.clinicMember.createMany({
			data: [{ clinicId, userId: users.cruz.id, role: 'user' }],
			skipDuplicates: true,
		});

		facilities.healthCenter = (
			await prisma.organization.create({ data: { name: 'Health Center', slug: 'hc', type: 'clinic' } })
		).id;
		facilities.hospital = (
			await prisma.organization.create({ data: { name: 'Regional Hospital', slug: 'rh', type: 'hospital' } })
		).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilities.healthCenter, userId: users.reyes.id, role: 'user' },
				{ orgId: facilities.hospital, userId: users.cruz.id, role: 'user' },
			],
		});

		const registered = await graphql(
			users.reyes.cookie,
			'mutation ($input: RegisterPatientInput!) { registerPatient(input: $input) { patient { id } } }',
			{
				input: {
					facilityId: facilities.healthCenter,
					givenName: 'Maria',
					familyName: 'Santos',
					birthDate: '1981-04-12',
					sex: 'female',
					mrn: 'THC-0001',
					consentGiven: true,
				},
			},
		);
		patientId = registered.body.data.registerPatient.patient.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('records an encounter for a patient in your care, with an audit row', async () => {
		const res = await graphql(users.reyes.cookie, CREATE_ENCOUNTER, {
			input: { patientId, facilityId: facilities.healthCenter, reason: ' Fatigue ', notes: 'BP 140/90.' },
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.createEncounter).toMatchObject({
			reason: 'Fatigue',
			notes: 'BP 140/90.',
			sourceChatId: null,
			facility: { name: 'Health Center' },
			doctor: { name: 'Dr. Reyes' },
		});
		expect(await prisma.auditLog.count({ where: { patientId, action: 'encounter.create' } })).toBe(1);

		const list = await graphql(users.reyes.cookie, ENCOUNTERS, { patientId });
		expect(list.body.data.encounters).toHaveLength(1);
	});

	it('hides the encounters from a doctor at another facility, and refuses theirs', async () => {
		const list = await graphql(users.cruz.cookie, ENCOUNTERS, { patientId });
		expect(list.body.data.encounters).toEqual([]);

		const atOwnFacility = await graphql(users.cruz.cookie, CREATE_ENCOUNTER, {
			input: { patientId, facilityId: facilities.hospital, reason: 'Check' },
		});
		expect(atOwnFacility.body.errors?.[0].extensions.code).toBe('NOT_FOUND');
		const atTheirs = await graphql(users.cruz.cookie, CREATE_ENCOUNTER, {
			input: { patientId, facilityId: facilities.healthCenter, reason: 'Check' },
		});
		expect(atTheirs.body.errors?.[0].extensions.code).toBe('FORBIDDEN');
	});

	it('refuses a chart chat about a patient the user cannot see', async () => {
		const res = await ask(users.cruz.cookie, { message: { text: 'Summarise her' }, patientId });
		expect(res.status).toBe(403);
		expect(await prisma.chat.count({ where: { patientId } })).toBe(0);
	});

	it('starts the chart chat: Wise knows the patient and drafts an encounter for them', async () => {
		const res = await ask(users.reyes.cookie, { message: { text: 'Fatigue again, BP 150/95' }, patientId });
		expect(res.status).toBe(200);
		const events = parseSse(res.body as string);
		chatId = events.find((event) => event.type === 'data-newChat')?.data.id;
		expect(chatId).toBeTruthy();

		expect(prompts[0]).toContain('## Current patient');
		expect(prompts[0]).toContain('- Name: Maria Santos');
		expect(prompts[0]).toContain('Fatigue — BP 140/90.');

		const output = events.find((event) => event.type === 'tool-output-available');
		expect(output?.output).toMatchObject({
			patientId,
			facilities: [{ id: facilities.healthCenter, name: 'Health Center' }],
		});

		expect(await prisma.chat.findUnique({ where: { id: chatId } })).toMatchObject({
			patientId,
			surface: 'patient',
		});
		const chat = await graphql(
			users.reyes.cookie,
			'query ($patientId: ID!) { patientChat(patientId: $patientId) }',
			{
				patientId,
			},
		);
		expect(chat.body.data.patientChat).toBe(chatId);
		const sidebar = await graphql(users.reyes.cookie, '{ chatList { groups { chats { id } } } }');
		expect(JSON.stringify(sidebar.body.data.chatList)).not.toContain(chatId);
	});

	it('keeps one chart chat per clinician per patient', async () => {
		const res = await ask(users.reyes.cookie, { message: { text: 'Another chat' }, patientId });
		expect(res.status).toBe(409);
	});

	it('links an encounter confirmed from the card to its chat, and only to that patient', async () => {
		const linked = await graphql(users.reyes.cookie, CREATE_ENCOUNTER, {
			input: {
				patientId,
				facilityId: facilities.healthCenter,
				reason: 'Fatigue follow-up',
				sourceChatId: chatId,
			},
		});
		expect(linked.body.data.createEncounter.sourceChatId).toBe(chatId);

		const other = await graphql(
			users.reyes.cookie,
			'mutation ($input: RegisterPatientInput!) { registerPatient(input: $input) { patient { id } } }',
			{
				input: {
					facilityId: facilities.healthCenter,
					givenName: 'Jose',
					familyName: 'Ramos',
					birthDate: '1966-09-03',
					sex: 'male',
					consentGiven: true,
				},
			},
		);
		const wrong = await graphql(users.reyes.cookie, CREATE_ENCOUNTER, {
			input: {
				patientId: other.body.data.registerPatient.patient.id,
				facilityId: facilities.healthCenter,
				reason: 'Check',
				sourceChatId: chatId,
			},
		});
		expect(wrong.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');
	});

	it('lets Wise draft a prescription for an encounter it names, and saves nothing', async () => {
		const jose = await graphql(users.reyes.cookie, '{ searchPatients(input: { query: "Ramos" }) { id } }');
		const josePatientId = jose.body.data.searchPatients[0].id;
		const created = await graphql(users.reyes.cookie, CREATE_ENCOUNTER, {
			input: { patientId: josePatientId, facilityId: facilities.healthCenter, reason: 'Sore throat' },
		});
		const encounterId = created.body.data.createEncounter.id;
		toolCall = {
			toolName: 'propose_prescription',
			input: {
				encounterId,
				items: [
					{
						genericName: 'Paracetamol',
						strength: '500 mg',
						dose: '1 tablet',
						frequency: 'every 4 hours as needed',
					},
				],
			},
		};
		prompts.length = 0;
		const res = await ask(users.reyes.cookie, {
			message: { text: 'Paracetamol for the fever' },
			patientId: josePatientId,
		});
		expect(res.status).toBe(200);
		expect(prompts[0]).toContain(`[encounter ${encounterId}]: Sore throat`);
		expect(prompts[0]).toContain('- Allergies: none recorded');
		const output = parseSse(res.body as string).find((event) => event.type === 'tool-output-available');
		expect(output?.output).toMatchObject({ success: true, patientId: josePatientId, encounterId });
		expect(await prisma.prescription.count({ where: { encounterId } })).toBe(0);
	});
});

interface ScriptedToolCall {
	toolName: string;
	input: object;
}

/** Step 1 calls the scripted tool (`propose_encounter` by default), step 2 answers; it records each system prompt. */
function scriptedModel(prompts: string[], nextToolCall: () => ScriptedToolCall): ProviderModelResult {
	let streamCalls = 0;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Fatigue visit' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async (options: LanguageModelV3CallOptions) => {
			streamCalls += 1;
			const system = options.prompt.find((message) => message.role === 'system');
			prompts.push(typeof system?.content === 'string' ? system.content : '');
			const parts: LanguageModelV3StreamPart[] =
				streamCalls % 2 === 1
					? [
							{
								type: 'tool-call',
								toolCallId: `call_${streamCalls}`,
								toolName: nextToolCall().toolName,
								input: JSON.stringify(nextToolCall().input),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: 'Draft shown.' },
							{ type: 'text-end', id: 'text_1' },
							{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
						];
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
	return { model, providerOptions: {}, contextWindow: 128_000 } as unknown as ProviderModelResult;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE events of every type
function parseSse(body: string): any[] {
	return body
		.split('\n')
		.filter((line) => line.startsWith('data: {'))
		.map((line) => JSON.parse(line.slice('data: '.length)));
}
