import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { SCRIBE_DEMO_TRANSCRIPT, scribeDemoDraft } from '@loopwise/shared/scribe-demo';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TranscribeService } from '../src/transcribe/transcribe.service.js';
import { createClinicScene } from './fixtures/clinic-fixtures.js';
import { createTestCatalog } from './fixtures/diagnostics-fixtures.js';
import { createTestApp, resetDatabase, signIn, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const TOOL = 'propose_scribe_note';

/**
 * The AI scribe end to end (DESIGN.md §7.5), with a scripted model and a mocked transcription provider: recording
 * needs the patient's consent for the visit; one Wise turn drafts the whole visit; each part confirms through its own
 * mutation, once, audited with the scribe card as origin; nothing is written before a Confirm.
 */
describe('AI scribe (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let encounterId = '';
	let organizationId = '';
	let chatId = '';
	const doctor = { cookie: [] as string[], id: '' };
	const script = { calls: 0, input: {} as Record<string, unknown> };
	const transcribeAudio = vi.fn();

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ query, variables });

	const ok = async (query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(query, variables);
		expect(res.body.errors, JSON.stringify(res.body.errors)).toBeUndefined();
		return res.body.data;
	};

	const transcribe = () =>
		request(app.getHttpServer())
			.post('/api/scribe/transcribe')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ encounterId, audio: Buffer.from('synthetic audio').toString('base64') });

	/** One Wise turn in the doctor's chart chat that drafts the scribe card from `input`. */
	const draft = async (input: Record<string, unknown>) => {
		script.input = input;
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', doctor.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ model: MODEL, ...(chatId ? { chatId } : { patientId }), message: { text: SCRIBE_DEMO_TRANSCRIPT } })
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
		const origin = (part: string, edited = false) => ({
			chatId,
			toolCallId: output.toolCallId as string,
			toolName: TOOL,
			edited,
			part,
		});
		return { output: output.output, origin };
	};

	const auditOrigin = async (event: string) =>
		(await prisma.auditLog.findFirstOrThrow({ where: { event }, orderBy: { createdAt: 'desc' } })).origin;

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);
		vi.spyOn(app.get(TranscribeService, { strict: false }), 'transcribeAudio').mockImplementation(transcribeAudio);

		const scene = await createClinicScene(prisma);
		clinicId = scene.clinic.id;
		organizationId = scene.organization.id;
		await prisma.clinic.update({ where: { id: clinicId }, data: { path: process.env.LOOPWISE_CLINICS_DIR } });
		await createTestCatalog(prisma, organizationId);
		for (const [code, name] of [
			['FBS', 'Fasting blood sugar (FBS)'],
			['LIPID', 'Lipid profile'],
		]) {
			await prisma.diagnosticTest.create({ data: { organizationId, code, name, category: 'LABORATORY' } });
		}
		await prisma.patientAllergy.create({
			data: { patientId: scene.patient.id, allergen: 'Losartan', type: 'DRUG', severity: 'MODERATE' },
		});
		Object.assign(doctor, { cookie: await signIn(app, scene.doctor), id: scene.doctor.id });
		patientId = scene.patient.id;
		encounterId = scene.encounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('records the consult only with the patient’s consent for the visit, and keeps no audio', async () => {
		const CONSENT = 'query ($id: ID!) { scribeConsent(encounterId: $id) { granted isActive type version } }';
		expect((await ok(CONSENT, { id: encounterId })).scribeConsent).toBeNull();

		const refused = await transcribe();
		expect(refused.status).toBe(403);
		expect(refused.body).toMatchObject({ errorCode: 'RECORDING_CONSENT_REQUIRED' });
		expect(transcribeAudio).not.toHaveBeenCalled();

		const RECORD =
			'mutation ($input: RecordScribeConsentInput!) { recordScribeConsent(input: $input) { granted isActive type } }';
		expect((await ok(RECORD, { input: { encounterId, granted: true } })).recordScribeConsent).toEqual({
			granted: true,
			isActive: true,
			type: 'PHOTO_VIDEO',
		});
		const consent = await prisma.patientConsent.findFirstOrThrow({ where: { encounterId } });
		expect(consent).toMatchObject({ patientId, type: 'PHOTO_VIDEO', granted: true, witnessedById: doctor.id });
		expect(consent.version).toMatch(/^scribe-recording-/);
		expect(await prisma.auditLog.count({ where: { event: 'consent.grant', entityId: consent.id } })).toBe(1);

		transcribeAudio.mockResolvedValueOnce(SCRIBE_DEMO_TRANSCRIPT);
		const transcribed = await transcribe();
		expect(transcribed.status).toBe(200);
		expect(transcribed.body.text).toBe(SCRIBE_DEMO_TRANSCRIPT);
		const exported = await prisma.auditLog.findFirstOrThrow({ where: { event: 'scribe.transcribe' } });
		expect(exported).toMatchObject({ action: 'EXPORT', entityId: encounterId, patientId, userId: doctor.id });

		// The patient changes their mind: the latest answer counts.
		await ok(RECORD, { input: { encounterId, granted: false } });
		expect((await ok(CONSENT, { id: encounterId })).scribeConsent.isActive).toBe(false);
		expect((await transcribe()).status).toBe(403);
	});

	it('drafts the whole visit in one card that writes nothing, with codes, tests and allergies resolved', async () => {
		const before = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
		const { output } = await draft(scribeDemoDraft(encounterId) as never);
		expect(output.parts).toEqual([
			'soap',
			'vitals',
			'diagnosis-0',
			'diagnosis-1',
			'prescription',
			'orders',
			'certificate',
			'follow_up',
			'summary',
		]);
		expect(output.diagnoses).toEqual([
			{ icd10Code: 'I10', known: true, title: 'Essential (primary) hypertension' },
			expect.objectContaining({ icd10Code: 'E11.9', known: true }),
		]);
		expect(output.tests.matched.map((test: { code: string }) => test.code)).toEqual(['HBA1C', 'FBS', 'LIPID']);
		expect(output.tests.unmatched).toEqual(['serum creatinine']);
		expect(output.allergyWarnings).toEqual([{ genericName: 'Losartan', allergen: 'Losartan' }]);

		// AI drafts, the doctor confirms: the draft changed nothing.
		const after = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
		expect(after.version).toBe(before.version);
		expect(await prisma.vitalSigns.count({ where: { encounterId } })).toBe(0);
		expect(await prisma.prescription.count({ where: { encounterId } })).toBe(0);
		expect(await prisma.wiseProposalOutcome.count()).toBe(0);
	});

	it('confirms each part through its own mutation, once, audited with the scribe card and the part', async () => {
		const demo = scribeDemoDraft(encounterId);
		const { output, origin } = await draft(demo as never);
		const encounter = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });

		const NOTE = 'mutation ($input: UpdateEncounterNoteInput!) { updateEncounterNote(input: $input) { version } }';
		const soap = {
			encounterId,
			reason: demo.soap!.chiefComplaint,
			history: demo.soap!.history,
			reviewOfSystems: demo.soap!.reviewOfSystems,
			subjective: demo.soap!.subjective,
			physicalExam: demo.soap!.physicalExam,
			objective: demo.soap!.objective,
			assessment: demo.soap!.assessment,
			plan: demo.soap!.plan,
			expectedVersion: encounter.version,
		};
		const saved = await ok(NOTE, { input: { ...soap, wiseOrigin: origin('soap', true) } });
		const note = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
		expect(note).toMatchObject({
			chiefComplaint: demo.soap!.chiefComplaint,
			subjective: demo.soap!.subjective,
			objective: demo.soap!.objective,
			reviewOfSystems: demo.soap!.reviewOfSystems,
		});
		expect(await auditOrigin('encounter.update_note')).toMatchObject({
			via: 'wise',
			toolName: TOOL,
			part: 'soap',
			edited: true,
			toolCallId: origin('soap').toolCallId,
		});
		// Settled once: the same part again is refused, and a part can't confirm another record's change.
		const again = await graphql(NOTE, {
			input: { ...soap, expectedVersion: saved.updateEncounterNote.version, wiseOrigin: origin('soap') },
		});
		expect(again.body.errors?.[0].extensions).toMatchObject({ code: 'CONFLICT' });
		const wrongPart = await graphql(NOTE, {
			input: { ...soap, expectedVersion: saved.updateEncounterNote.version, wiseOrigin: origin('vitals') },
		});
		expect(wrongPart.body.errors?.[0].message).toMatch(/can't confirm this change/);
		const noPart = await graphql(NOTE, {
			input: {
				...soap,
				expectedVersion: saved.updateEncounterNote.version,
				wiseOrigin: { ...origin('follow_up'), part: null },
			},
		});
		expect(noPart.body.errors?.[0].message).toMatch(/Name the part/);

		await ok('mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id } }', {
			input: { encounterId, ...demo.vitals, wiseOrigin: origin('vitals') },
		});
		expect(await auditOrigin('vitals.record')).toMatchObject({ toolName: TOOL, part: 'vitals' });

		for (const [index, diagnosis] of demo.diagnoses!.entries()) {
			await ok('mutation ($input: AddDiagnosisInput!) { addDiagnosis(input: $input) { id } }', {
				input: { encounterId, ...diagnosis, isFinal: true, wiseOrigin: origin(`diagnosis-${index}`) },
			});
		}
		expect(
			await prisma.encounterDiagnosis.findMany({
				where: { encounterId },
				select: { icd10Code: true, type: true },
				orderBy: { sortOrder: 'asc' },
			}),
		).toEqual([
			{ icd10Code: 'I10', type: 'PRIMARY' },
			{ icd10Code: 'E11.9', type: 'SECONDARY' },
		]);

		await ok('mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { id } }', {
			input: { encounterId, items: demo.prescription!.items, wiseOrigin: origin('prescription') },
		});
		expect(await auditOrigin('prescription.save')).toMatchObject({ toolName: TOOL, part: 'prescription' });

		await ok('mutation ($input: CreateDiagnosticOrderInput!) { createDiagnosticOrder(input: $input) { id } }', {
			input: {
				encounterId,
				testIds: output.tests.matched.map((test: { testId: string }) => test.testId),
				wiseOrigin: origin('orders'),
			},
		});
		expect(await prisma.diagnosticOrderItem.count({ where: { order: { encounterId } } })).toBe(3);

		await ok('mutation ($input: SaveMedicalCertificateInput!) { saveMedicalCertificate(input: $input) { id } }', {
			input: {
				encounterId,
				diagnosisText: 'Essential hypertension; type 2 diabetes mellitus',
				examinedOn: new Date().toISOString().slice(0, 10),
				restDays: 1,
				restFrom: new Date().toISOString().slice(0, 10),
				isFitToWork: false,
				purpose: 'work',
				wiseOrigin: origin('certificate'),
			},
		});

		// The follow-up part writes the date and disposition onto the note it read, at that note's version.
		const current = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
		await ok(NOTE, {
			input: {
				...soap,
				followUpOn: '2026-11-20',
				disposition: 'FOR_FOLLOW_UP',
				expectedVersion: current.version,
				wiseOrigin: origin('follow_up'),
			},
		});
		expect(await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } })).toMatchObject({
			disposition: 'FOR_FOLLOW_UP',
			subjective: demo.soap!.subjective,
		});

		// Dismissing the summary settles only that part.
		await ok(
			'mutation ($input: WiseOriginInput!) { cancelWiseProposal(input: $input) { toolCallId status edited } }',
			{ input: origin('summary') },
		);
		const outcomes = await ok(
			'query ($chatId: ID!) { wiseProposalOutcomes(chatId: $chatId) { toolCallId status edited } }',
			{ chatId },
		);
		const byPart = Object.fromEntries(
			outcomes.wiseProposalOutcomes
				.filter((outcome: { toolCallId: string }) =>
					outcome.toolCallId.startsWith(`${origin('soap').toolCallId}#`),
				)
				.map((outcome: { toolCallId: string; status: string; edited: boolean }) => [
					outcome.toolCallId.split('#')[1],
					outcome.edited ? `${outcome.status} (edited)` : outcome.status,
				]),
		);
		expect(byPart).toEqual({
			soap: 'confirmed (edited)',
			vitals: 'confirmed',
			'diagnosis-0': 'confirmed',
			'diagnosis-1': 'confirmed',
			prescription: 'confirmed',
			orders: 'confirmed',
			certificate: 'confirmed',
			follow_up: 'confirmed',
			summary: 'cancelled',
		});
	});

	it('refuses a part whose own card is turned off in Wise settings', async () => {
		const { origin } = await draft(scribeDemoDraft(encounterId) as never);
		await prisma.prescription.deleteMany({ where: { encounterId, documentStatus: 'DRAFT' } });
		await prisma.wiseToolSetting.create({
			data: { organizationId, toolName: 'propose_prescription', enabled: false, updatedById: doctor.id },
		});
		const res = await graphql(
			'mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { id } }',
			{
				input: {
					encounterId,
					items: scribeDemoDraft(encounterId).prescription!.items,
					wiseOrigin: origin('prescription'),
				},
			},
		);
		expect(res.body.errors?.[0].message).toMatch(/turned off|not enabled|off/i);
		await prisma.wiseToolSetting.deleteMany({ where: { organizationId } });
	});
});

/** Calls `propose_scribe_note` with `script.input` on the first step of each turn, then answers in text. */
function scriptedModel(script: { calls: number; input: Record<string, unknown> }): ProviderModelResult {
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
								toolCallId: `scribe_call_${script.calls}`,
								toolName: TOOL,
								input: JSON.stringify(script.input),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: 'Drafted the visit; nothing is saved yet.' },
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
