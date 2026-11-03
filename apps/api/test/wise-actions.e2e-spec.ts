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
const RECORD_VITALS = `mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id systolicMmHg } }`;
const ADD_ALLERGY = `mutation ($input: AddAllergyInput!) { addAllergy(input: $input) { id substance } }`;
const VOID_ALLERGY = `mutation ($input: VoidAllergyInput!) { voidAllergy(input: $input) { id } }`;
const CREATE_ORDERS = `mutation ($input: CreateEncounterOrdersInput!) { createEncounterOrders(input: $input) { id code status } }`;
const REVIEW = `mutation ($input: ReviewResultInput!) { reviewResult(input: $input) { id reviewedAt } }`;

/**
 * Wise actions (DESIGN.md §9.4) end to end, with a scripted model: each tool drafts a card and writes nothing; the
 * card's Confirm goes through the real mutation as the user, settles the card once, and the audit row records the
 * Wise origin. Another clinician can't confirm the card, a critical result needs a note, and an order card creates
 * all its tests in one transaction, queued for HL7 when the lab uses the connector.
 */
describe('Wise actions (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let projectId = '';
	let facilityId = '';
	let labId = '';
	let patientId = '';
	let encounterId = '';
	let chatId = '';
	const doctor = { cookie: [] as string[], id: '' };
	const other = { cookie: [] as string[], id: '' };
	const script = { calls: 0, toolName: '', input: {} as Record<string, unknown> };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-loopwise-project-id': projectId } : {})
			.send({ query, variables });

	/** One Wise turn in the doctor's chart chat that calls `toolName`; returns the card. */
	const draft = async (toolName: string, input: Record<string, unknown>) => {
		Object.assign(script, { toolName, input });
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-project-id', projectId)
			.send({ model: MODEL, ...(chatId ? { chatId } : { patientId }), message: { text: toolName } })
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			});
		expect(res.status).toBe(200);
		const events = parseSse(res.body as string);
		chatId ||= events.find((event) => event.type === 'data-newChat')?.data.id;
		const output = events.find((event) => event.type === 'tool-output-available');
		expect(output, JSON.stringify(events.filter((event) => event.type?.startsWith('tool')))).toBeTruthy();
		return {
			output: output.output,
			origin: { chatId, toolCallId: output.toolCallId as string, toolName, edited: false },
		};
	};

	const wiseAudit = (action: string) =>
		prisma.auditLog.findFirstOrThrow({ where: { action, origin: { not: undefined } }, orderBy: { at: 'desc' } });

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		Object.assign(doctor, { cookie: reyes.cookie, id: reyes.userId });
		Object.assign(other, { cookie: cruz.cookie, id: cruz.userId });
		projectId = (await graphql(doctor.cookie, 'mutation { createProject(input: { name: "Clinic" }) { id } }')).body
			.data.createProject.id;
		await prisma.projectMember.create({ data: { projectId, userId: other.id, role: 'user' } });
		const [clinic, elsewhere, lab] = await Promise.all([
			prisma.organization.create({ data: { name: 'Health Center', slug: 'hc', type: 'clinic' } }),
			prisma.organization.create({ data: { name: 'Other Clinic', slug: 'other', type: 'clinic' } }),
			prisma.organization.create({
				data: { name: 'Bohol Diagnostics', slug: 'lab', type: 'lab', usesHl7Connector: true },
			}),
		]);
		facilityId = clinic.id;
		labId = lab.id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilityId, userId: doctor.id, role: 'user' },
				{ orgId: elsewhere.id, userId: other.id, role: 'user' },
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
				{ input: { patientId, facilityId, reason: 'BP check' } },
			)
		).body.data.createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('records vitals from a propose_vitals card, once, with the Wise origin on the audit row', async () => {
		const before = await prisma.vitalSigns.count();
		const card = await draft('propose_vitals', { encounterId, vitals: { systolicMmHg: 150, diastolicMmHg: 95 } });
		expect(card.output).toMatchObject({ patientId, subjectId: encounterId });
		expect(await prisma.vitalSigns.count()).toBe(before);

		const input = { encounterId, systolicMmHg: 150, diastolicMmHg: 95, wiseOrigin: card.origin };
		const res = await graphql(doctor.cookie, RECORD_VITALS, { input });
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.recordVitals.systolicMmHg).toBe(150);
		expect((await wiseAudit('vitals.record')).origin).toMatchObject({ via: 'wise', toolName: 'propose_vitals' });
		expect(
			await prisma.wiseProposalOutcome.findUnique({ where: { toolCallId: card.origin.toolCallId } }),
		).toMatchObject({
			status: 'confirmed',
			resource: 'vital_signs',
		});

		const again = await graphql(doctor.cookie, RECORD_VITALS, { input });
		expect(again.body.errors?.[0].message).toMatch(/already confirmed/);
		expect(await prisma.vitalSigns.count()).toBe(before + 1);
	});

	it("refuses another clinician's Confirm of the card, and their write to a visit they can't see", async () => {
		const card = await draft('propose_vitals', { encounterId, vitals: { heartRateBpm: 80 } });
		const stolen = await graphql(other.cookie, RECORD_VITALS, {
			input: { encounterId, heartRateBpm: 80, wiseOrigin: card.origin },
		});
		expect(stolen.body.errors?.[0].message).toMatch(/isn't in your chat/);
		const direct = await graphql(other.cookie, RECORD_VITALS, { input: { encounterId, heartRateBpm: 80 } });
		expect(direct.body.errors).toBeDefined();
	});

	it('adds and removes an allergy from cards; the removal needs a reason', async () => {
		const add = await draft('propose_allergy', { substance: 'Penicillin', reaction: 'Rash' });
		const added = await graphql(doctor.cookie, ADD_ALLERGY, {
			input: { patientId, facilityId, substance: 'Penicillin', reaction: 'Rash', wiseOrigin: add.origin },
		});
		expect(added.body.errors).toBeUndefined();
		expect((await wiseAudit('allergy.add')).origin).toMatchObject({ toolName: 'propose_allergy' });

		const remove = await draft('propose_remove_allergy', { substance: 'Penicillin' });
		const id = added.body.data.addAllergy.id;
		const noReason = await graphql(doctor.cookie, VOID_ALLERGY, {
			input: { id, reason: '', wiseOrigin: remove.origin },
		});
		expect(noReason.body.errors).toBeDefined();
		const removed = await graphql(doctor.cookie, VOID_ALLERGY, {
			input: { id, reason: 'Entered in error', wiseOrigin: remove.origin },
		});
		expect(removed.body.errors).toBeUndefined();
		expect((await prisma.patientAllergy.findUniqueOrThrow({ where: { id } })).voidedAt).not.toBeNull();
		expect((await wiseAudit('allergy.void')).origin).toMatchObject({ toolName: 'propose_remove_allergy' });
	});

	it('orders several tests from one card in one transaction, queued for HL7', async () => {
		const card = await draft('propose_order', { encounterId, tests: ['HbA1c', 'FBS'], targetFacility: 'Bohol' });
		expect(card.output.tests.map((test: { code: string }) => test.code)).toEqual(['4548-4', '1558-6']);

		const refused = await graphql(doctor.cookie, CREATE_ORDERS, {
			input: { encounterId, codes: ['4548-4', 'nope'], targetOrgId: labId, wiseOrigin: card.origin },
		});
		expect(refused.body.errors?.[0].message).toMatch(/Pick tests/);
		expect(await prisma.clinicalOrder.count()).toBe(0);

		const res = await graphql(doctor.cookie, CREATE_ORDERS, {
			input: { encounterId, codes: ['4548-4', '1558-6'], targetOrgId: labId, wiseOrigin: card.origin },
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.createEncounterOrders).toHaveLength(2);
		expect(await prisma.hl7Outbox.count()).toBe(2);
		const audits = await prisma.auditLog.findMany({ where: { action: 'order.create' } });
		expect(audits.map((audit) => (audit.origin as { toolName: string }).toolName)).toEqual([
			'propose_order',
			'propose_order',
		]);
		expect(await prisma.wiseProposalOutcome.count({ where: { toolCallId: card.origin.toolCallId } })).toBe(1);
	});

	it('lists the results to review, and a critical one needs a note to be reviewed from its card', async () => {
		const order = await prisma.clinicalOrder.findFirstOrThrow({ where: { code: '4548-4' } });
		await prisma.clinicalOrder.update({ where: { id: order.id }, data: { status: 'resulted' } });
		const result = await prisma.result.create({
			data: {
				orderId: order.id,
				patientId,
				sourceOrgId: labId,
				code: '4548-4',
				display: 'Hemoglobin A1c',
				value: '12.4',
				unit: '%',
				refRange: '4.0-5.6',
				flag: 'critical_high',
				resultedAt: new Date(),
			},
		});

		const list = await draft('list_results_to_review', {});
		expect(list.output.results).toEqual([
			expect.objectContaining({
				id: result.id,
				test: 'Hemoglobin A1c',
				value: '12.4',
				urgency: 'critical',
				lab: 'Bohol Diagnostics',
				evaluation: null,
			}),
		]);
		expect(
			await prisma.auditLog.count({ where: { action: 'result.list', reason: 'Wise list_results_to_review' } }),
		).toBe(1);

		const card = await draft('propose_result_review', { resultId: result.id });
		expect(card.output).toMatchObject({ subjectId: result.id });
		const noNote = await graphql(doctor.cookie, REVIEW, {
			input: { resultId: result.id, wiseOrigin: card.origin },
		});
		expect(noNote.body.errors?.[0].message).toMatch(/critical result needs your note/);

		const res = await graphql(doctor.cookie, REVIEW, {
			input: { resultId: result.id, note: 'Called the patient; seen today.', wiseOrigin: card.origin },
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.reviewResult.reviewedAt).not.toBeNull();
		expect((await wiseAudit('result.review')).origin).toMatchObject({ toolName: 'propose_result_review' });
	});
});

/** Calls `script.toolName` on the first step of each turn, then answers in text. */
function scriptedModel(script: {
	calls: number;
	toolName: string;
	input: Record<string, unknown>;
}): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Title' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async (options) => {
			script.calls += 1;
			const lastMessage = options.prompt[options.prompt.length - 1];
			const parts: LanguageModelV3StreamPart[] =
				lastMessage?.role !== 'tool'
					? [
							{
								type: 'tool-call',
								toolCallId: `action_call_${script.calls}`,
								toolName: script.toolName,
								input: JSON.stringify(script.input),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: 'Draft shown; nothing is saved yet.' },
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
