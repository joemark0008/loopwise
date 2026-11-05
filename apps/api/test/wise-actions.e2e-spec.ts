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
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicScene } from './fixtures/clinic-fixtures.js';
import { createTestApp, resetDatabase, signIn, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const RECORD_VITALS = `mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id systolicMmHg } }`;
const ADD_ALLERGY = `mutation ($input: AddAllergyInput!) { addAllergy(input: $input) { id allergen } }`;
const VOID_ALLERGY = `mutation ($input: VoidAllergyInput!) { voidAllergy(input: $input) { id } }`;

/**
 * Wise actions (DESIGN.md §7.3) end to end, with a scripted model: each tool drafts a card and writes nothing; the
 * card's Confirm goes through the real mutation as the user, settles the card once, and the audit row records the
 * Wise origin. Another clinician can't confirm the card. The other record cards are in
 * `wise-actions-records.e2e-spec.ts`; the diagnostics cards (orders, lab steps, result review) in the diagnostics specs.
 */
describe('Wise actions (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
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
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	/** One Wise turn in the doctor's chart chat that calls `toolName`; returns the card. */
	const draft = async (toolName: string, input: Record<string, unknown>) => {
		Object.assign(script, { toolName, input });
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-clinic-id', clinicId)
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

	const wiseAudit = (event: string) =>
		prisma.auditLog.findFirstOrThrow({
			where: { event, origin: { not: Prisma.DbNull } },
			orderBy: { createdAt: 'desc' },
		});

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		// Dr. Reyes has Maria in care, with an open visit; Dr. Cruz works at the clinic but has no care relationship.
		const scene = await createClinicScene(prisma);
		clinicId = scene.clinic.id;
		await prisma.clinic.update({ where: { id: clinicId }, data: { path: process.env.LOOPWISE_CLINICS_DIR } });
		Object.assign(doctor, { cookie: await signIn(app, scene.doctor), id: scene.doctor.id });
		Object.assign(other, { cookie: await signIn(app, scene.otherDoctor), id: scene.otherDoctor.id });
		patientId = scene.patient.id;
		encounterId = scene.encounter.id;
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
			entityType: 'VitalSigns',
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
		// The visit is hidden from them (row-level security) before the card is even looked at.
		expect(stolen.body.errors?.[0].extensions.errorCode).toBe('ENTITY_NOT_FOUND');
		const direct = await graphql(other.cookie, RECORD_VITALS, { input: { encounterId, heartRateBpm: 80 } });
		expect(direct.body.errors).toBeDefined();
	});

	it('adds and removes an allergy from cards; the removal needs a reason', async () => {
		const add = await draft('propose_allergy', { allergen: 'Penicillin', reaction: 'Rash' });
		const added = await graphql(doctor.cookie, ADD_ALLERGY, {
			input: { patientId, allergen: 'Penicillin', reaction: 'Rash', wiseOrigin: add.origin },
		});
		expect(added.body.errors).toBeUndefined();
		expect((await wiseAudit('allergy.add')).origin).toMatchObject({ toolName: 'propose_allergy' });

		const remove = await draft('propose_remove_allergy', { allergen: 'Penicillin' });
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
