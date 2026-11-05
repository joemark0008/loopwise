import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const UPDATE_NOTE = `mutation ($input: UpdateEncounterNoteInput!) { updateEncounterNote(input: $input) { plan version } }`;
const CANCEL = `mutation ($input: WiseOriginInput!) { cancelWiseProposal(input: $input) { toolCallId status } }`;
const OUTCOMES = `query ($chatId: ID!) { wiseProposalOutcomes(chatId: $chatId) { toolCallId toolName status resourceId } }`;

/**
 * "AI drafts, the clinician confirms" (DESIGN.md §7.1) end to end: a Wise turn that drafts a note change writes
 * nothing; the card's Confirm goes through `updateEncounterNote` as the user, settles the card once, refuses a stale
 * draft, and the audit row records that it came from Wise. The LLM is a scripted mock calling `propose_encounter_note`.
 */
describe('Wise confirmation (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let encounterId = '';
	let chatId = '';
	const user = { cookie: [] as string[], id: '' };
	const other = { cookie: [] as string[], id: '' };
	const calls = { count: 0 };
	/** The proposal the scripted model makes next. */
	const script: { toolName: string; input: Record<string, unknown> } = {
		toolName: 'propose_encounter_note',
		input: { plan: 'Recheck BP in 2 weeks.' },
	};

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	const ask = (body: Record<string, unknown>) =>
		request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', user.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ model: MODEL, ...body })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});

	/** One Wise turn that drafts a note change; returns the card (tool call id and output). */
	const draft = async (text: string) => {
		const res = await ask(chatId ? { chatId, message: { text } } : { message: { text }, patientId });
		expect(res.status).toBe(200);
		const events = parseSse(res.body as string);
		chatId ||= events.find((event) => event.type === 'data-newChat')?.data.id;
		const output = events.find((event) => event.type === 'tool-output-available');
		expect(output).toBeTruthy();
		return { toolCallId: output.toolCallId as string, output: output.output };
	};

	const origin = (toolCallId: string, edited = false) => ({
		chatId,
		toolCallId,
		toolName: 'propose_encounter_note',
		edited,
	});

	const writes = async () => ({
		encounters: await prisma.encounter.count(),
		actions: await prisma.auditLog.count({ where: { NOT: { action: { endsWith: '.view' } } } }),
		outcomes: await prisma.wiseProposalOutcome.count(),
		note: (await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } })).plan,
	});

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(calls, script),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		Object.assign(user, { cookie: reyes.cookie, id: reyes.userId });
		Object.assign(other, { cookie: cruz.cookie, id: cruz.userId });
		clinicId = (await graphql(user.cookie, 'mutation { createClinic(input: { name: "Clinic" }) { id } }')).body.data
			.createClinic.id;
		await prisma.clinicMember.create({ data: { clinicId, userId: other.id, role: 'user' } });
		const facility = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facility.id, userId: user.id, role: 'user' },
				{ orgId: facility.id, userId: other.id, role: 'user' },
			],
		});

		const registered = await graphql(
			user.cookie,
			'mutation ($input: RegisterPatientInput!) { registerPatient(input: $input) { patient { id } } }',
			{
				input: {
					facilityId: facility.id,
					givenName: 'Maria',
					familyName: 'Santos',
					birthDate: '1981-04-12',
					sex: 'female',
					consentGiven: true,
				},
			},
		);
		patientId = registered.body.data.registerPatient.patient.id;
		const encounter = await graphql(
			user.cookie,
			'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
			{ input: { patientId, facilityId: facility.id, reason: 'Fatigue' } },
		);
		encounterId = encounter.body.data.createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('drafts a note change in a Wise turn without writing anything', async () => {
		const before = await writes();
		const { output } = await draft('Plan: recheck BP in 2 weeks');
		expect(output).toMatchObject({
			encounter: { id: encounterId, facilityName: 'Health Center' },
			patientName: 'Maria Santos',
			current: { reason: 'Fatigue', plan: null },
			version: 1,
		});
		expect(await writes()).toEqual(before);
	});

	it('confirms the card through updateEncounterNote as the user, with the Wise origin on the audit row', async () => {
		const card = await draft('Plan: recheck BP in 2 weeks');
		const res = await graphql(user.cookie, UPDATE_NOTE, {
			input: {
				encounterId,
				reason: 'Fatigue',
				plan: 'Recheck BP in 2 weeks; low-salt diet.',
				expectedVersion: card.output.version,
				wiseOrigin: origin(card.toolCallId, true),
			},
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.updateEncounterNote).toEqual({
			plan: 'Recheck BP in 2 weeks; low-salt diet.',
			version: 2,
		});

		const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'encounter.update_note' } });
		expect(audit).toMatchObject({ userId: user.id, patientId, resourceId: encounterId });
		expect(audit.origin).toMatchObject({
			via: 'wise',
			toolName: 'propose_encounter_note',
			chatId,
			toolCallId: card.toolCallId,
			edited: true,
		});
		expect((audit.origin as { messageId: string }).messageId).toBeTruthy();

		const outcomes = await graphql(user.cookie, OUTCOMES, { chatId });
		expect(outcomes.body.data.wiseProposalOutcomes).toEqual([
			{
				toolCallId: card.toolCallId,
				toolName: 'propose_encounter_note',
				status: 'confirmed',
				resourceId: encounterId,
			},
		]);

		// A replayed card (reload, second tab, double click) can't be confirmed again.
		const again = await graphql(user.cookie, UPDATE_NOTE, {
			input: { encounterId, reason: 'Fatigue', plan: 'Twice', wiseOrigin: origin(card.toolCallId) },
		});
		expect(again.body.errors?.[0].extensions.code).toBe('CONFLICT');
		expect(again.body.errors?.[0].message).toMatch(/already confirmed/);
		expect((await writes()).note).toBe('Recheck BP in 2 weeks; low-salt diet.');
	});

	it('refuses a stale draft and leaves both the note and the card as they were', async () => {
		const card = await draft('Add metformin to the plan');
		expect(card.output.version).toBe(2);
		await graphql(user.cookie, UPDATE_NOTE, { input: { encounterId, reason: 'Fatigue', plan: 'Edited by hand' } });

		const res = await graphql(user.cookie, UPDATE_NOTE, {
			input: {
				encounterId,
				reason: 'Fatigue',
				plan: 'Recheck BP; metformin 500 mg',
				expectedVersion: card.output.version,
				wiseOrigin: origin(card.toolCallId),
			},
		});
		expect(res.body.errors?.[0].extensions.code).toBe('CONFLICT');
		expect(res.body.errors?.[0].message).toMatch(/changed after this edit was drafted/);
		expect((await writes()).note).toBe('Edited by hand');
		expect(await prisma.wiseProposalOutcome.count({ where: { toolCallId: card.toolCallId } })).toBe(0);
	});

	it('refuses to confirm a cancelled card', async () => {
		const card = await draft('Plan: refer to cardiology');
		const cancelled = await graphql(user.cookie, CANCEL, { input: origin(card.toolCallId) });
		expect(cancelled.body.data.cancelWiseProposal).toEqual({ toolCallId: card.toolCallId, status: 'cancelled' });

		const res = await graphql(user.cookie, UPDATE_NOTE, {
			input: { encounterId, reason: 'Fatigue', plan: 'Refer', wiseOrigin: origin(card.toolCallId) },
		});
		expect(res.body.errors?.[0].extensions.code).toBe('CONFLICT');
		expect(res.body.errors?.[0].message).toMatch(/cancelled/);
	});

	it("refuses a card from another tool or another user's chat", async () => {
		const card = await draft('Plan: refer to cardiology');
		const wrongTool = await graphql(user.cookie, UPDATE_NOTE, {
			input: {
				encounterId,
				reason: 'Fatigue',
				plan: 'x',
				wiseOrigin: { ...origin(card.toolCallId), toolName: 'propose_encounter' },
			},
		});
		expect(wrongTool.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');

		const notTheirs = await graphql(other.cookie, UPDATE_NOTE, {
			input: { encounterId, reason: 'Fatigue', plan: 'x', wiseOrigin: origin(card.toolCallId) },
		});
		expect(notTheirs.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');
		expect(await prisma.wiseProposalOutcome.count({ where: { toolCallId: card.toolCallId } })).toBe(0);
	});

	describe('documents and follow-up writes', () => {
		const SAVE_RX = `mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { id version } }`;
		const amlodipine = {
			genericName: 'Amlodipine',
			strength: '5 mg',
			dose: '1 tablet',
			frequency: 'once a day',
			quantity: 30,
		};
		const rxOrigin = (toolCallId: string) => ({ ...origin(toolCallId), toolName: 'propose_prescription' });

		it('saves a prescription draft from its card, and refuses a change to a draft that moved on', async () => {
			Object.assign(script, { toolName: 'propose_prescription', input: { encounterId, items: [amlodipine] } });
			const first = await draft('Amlodipine 5 mg once a day');
			const saved = await graphql(user.cookie, SAVE_RX, {
				input: { encounterId, items: [amlodipine], wiseOrigin: rxOrigin(first.toolCallId) },
			});
			expect(saved.body.errors).toBeUndefined();
			const rx = saved.body.data.savePrescription;
			expect(rx.version).toBe(1);
			const audit = await prisma.auditLog.findFirstOrThrow({
				where: { action: 'prescription.save', resourceId: rx.id },
			});
			expect(audit.origin).toMatchObject({
				via: 'wise',
				toolName: 'propose_prescription',
				toolCallId: first.toolCallId,
			});

			const second = await draft('Make it 10 mg');
			// Someone edits the draft by hand after the card showed version 1.
			await graphql(user.cookie, SAVE_RX, {
				input: { id: rx.id, encounterId, items: [{ ...amlodipine, strength: '7.5 mg' }] },
			});
			const stale = await graphql(user.cookie, SAVE_RX, {
				input: {
					id: rx.id,
					encounterId,
					items: [{ ...amlodipine, strength: '10 mg' }],
					expectedVersion: 1,
					wiseOrigin: rxOrigin(second.toolCallId),
				},
			});
			expect(stale.body.errors?.[0].extensions.code).toBe('CONFLICT');
			expect(stale.body.errors?.[0].message).toMatch(/prescription was changed after this edit was drafted/);
			const items = await prisma.prescriptionItem.findMany({ where: { prescriptionId: rx.id } });
			expect(items.map((item) => item.strength)).toEqual(['7.5 mg']);

			const fresh = await graphql(user.cookie, SAVE_RX, {
				input: {
					id: rx.id,
					encounterId,
					items: [{ ...amlodipine, strength: '10 mg' }],
					expectedVersion: 2,
					wiseOrigin: rxOrigin(second.toolCallId),
				},
			});
			expect(fresh.body.data.savePrescription.version).toBe(3);
		});

		it('records the vitals a confirmed encounter card drafted, marked as from Wise, and only for that card', async () => {
			Object.assign(script, {
				toolName: 'propose_encounter',
				input: { reason: 'BP check', vitals: { systolicMmHg: 150, diastolicMmHg: 95 } },
			});
			const card = await draft('BP check, 150/95');
			const encounterOrigin = { ...origin(card.toolCallId), toolName: 'propose_encounter' };
			const RECORD_VITALS = `mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id } }`;
			const facilityId = (await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } })).orgId;

			// Not confirmed yet: the vitals can't claim the card.
			const early = await graphql(user.cookie, RECORD_VITALS, {
				input: { encounterId, systolicMmHg: 150, diastolicMmHg: 95, wiseOrigin: encounterOrigin },
			});
			expect(early.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');

			const created = await graphql(
				user.cookie,
				'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
				{
					input: {
						patientId,
						facilityId,
						reason: 'BP check',
						sourceChatId: chatId,
						wiseOrigin: encounterOrigin,
					},
				},
			);
			const newEncounterId = created.body.data.createEncounter.id;
			const vitals = await graphql(user.cookie, RECORD_VITALS, {
				input: {
					encounterId: newEncounterId,
					systolicMmHg: 150,
					diastolicMmHg: 95,
					wiseOrigin: encounterOrigin,
				},
			});
			expect(vitals.body.errors).toBeUndefined();
			const audit = await prisma.auditLog.findFirstOrThrow({
				where: { action: 'vitals.record', resourceId: vitals.body.data.recordVitals.id },
			});
			expect(audit.origin).toMatchObject({
				via: 'wise',
				toolName: 'propose_encounter',
				toolCallId: card.toolCallId,
			});

			// The card confirmed into the new encounter, not into another one.
			const elsewhere = await graphql(user.cookie, RECORD_VITALS, {
				input: { encounterId, systolicMmHg: 150, diastolicMmHg: 95, wiseOrigin: encounterOrigin },
			});
			expect(elsewhere.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');
		});
	});
});

/** Odd calls make the scripted proposal (a note change by default), even calls answer. */
function scriptedModel(
	calls: { count: number },
	script: { toolName: string; input: Record<string, unknown> },
): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Note change' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async () => {
			calls.count += 1;
			const parts: LanguageModelV3StreamPart[] =
				calls.count % 2 === 1
					? [
							{
								type: 'tool-call',
								toolCallId: `wise_call_${calls.count}`,
								toolName: script.toolName,
								input: JSON.stringify(script.input),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: 'Change shown; nothing is saved yet.' },
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
