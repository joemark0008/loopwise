import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PSGC_TAGBILARAN, PSGC_TAGBILARAN_BARANGAYS } from '../prisma/seed-reference.js';
import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicScene, createUser, grantClinicRoles } from './fixtures/clinic-fixtures.js';
import { createTestApp, resetDatabase, signIn, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };

/**
 * Wise actions on the record (DESIGN.md §7.3) end to end, with a scripted model: diagnoses, voids, issuing and voiding
 * a prescription, and contact details. Each card writes nothing; its Confirm goes through the real mutation, settles
 * once, and the audit row records Wise. Orders and lab steps are in `lab-orders.e2e-spec.ts`, bills in the billing
 * specs.
 */
describe('Wise record actions (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let encounterId = '';
	const chats: Record<string, string> = {};
	const doctor = { cookie: [] as string[], id: '' };
	const tech = { cookie: [] as string[], id: '' };
	const script = { calls: 0, toolName: '', input: {} as Record<string, unknown> };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	const ok = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(cookie, query, variables);
		expect(res.body.errors, JSON.stringify(res.body.errors)).toBeUndefined();
		return res.body.data;
	};

	/** One Wise turn that calls `toolName`: the doctor's chart chat, or the lab tech's general chat. */
	const draft = async (toolName: string, input: Record<string, unknown>, as: 'doctor' | 'tech' = 'doctor') => {
		Object.assign(script, { toolName, input });
		const user = as === 'doctor' ? doctor : tech;
		const chatId = chats[as];
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', user.cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({
				model: MODEL,
				...(chatId ? { chatId } : as === 'doctor' ? { patientId } : {}),
				message: { text: toolName },
			})
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			});
		expect(res.status).toBe(200);
		const events = parseSse(res.body as string);
		chats[as] ||= events.find((event) => event.type === 'data-newChat')?.data.id;
		const output = events.find((event) => event.type === 'tool-output-available');
		expect(output, JSON.stringify(events.filter((event) => event.type?.startsWith('tool')))).toBeTruthy();
		return {
			output: output.output,
			origin: { chatId: chats[as], toolCallId: output.toolCallId as string, toolName, edited: false },
		};
	};

	const wiseAudit = async (event: string) =>
		(await prisma.auditLog.findFirstOrThrow({ where: { event }, orderBy: { createdAt: 'desc' } })).origin as {
			via?: string;
			toolName?: string;
		} | null;

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		// Dr. Reyes has Maria in care at a clinic of Tagbilaran; the medtech of the clinic sees no patient yet.
		const scene = await createClinicScene(prisma);
		clinicId = scene.clinic.id;
		await prisma.clinic.update({
			where: { id: clinicId },
			data: { path: process.env.LOOPWISE_CLINICS_DIR, cityMunicipalityCode: PSGC_TAGBILARAN.code },
		});
		Object.assign(doctor, { cookie: await signIn(app, scene.doctor), id: scene.doctor.id });
		const medtech = await createUser(prisma, { firstName: 'Lab', lastName: 'Bautista' });
		await grantClinicRoles(prisma, clinicId, medtech.id, ['MEDTECH']);
		Object.assign(tech, { cookie: await signIn(app, medtech), id: medtech.id });
		patientId = scene.patient.id;
		encounterId = scene.encounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('adds a diagnosis from a card, changes it from a second one, and voids it from a third', async () => {
		const add = await draft('propose_diagnosis', { encounterId, icd10Code: 'I10', description: 'Hypertension' });
		const added = await ok(
			doctor.cookie,
			'mutation ($input: AddDiagnosisInput!) { addDiagnosis(input: $input) { id type isFinal } }',
			{
				input: {
					encounterId,
					icd10Code: 'I10',
					description: 'Hypertension',
					isFinal: false,
					wiseOrigin: add.origin,
				},
			},
		);
		expect(added.addDiagnosis).toMatchObject({ type: 'PRIMARY', isFinal: false });
		expect(await wiseAudit('diagnosis.add')).toMatchObject({ via: 'wise', toolName: 'propose_diagnosis' });

		const change = await draft('propose_diagnosis', {
			encounterId,
			icd10Code: 'I10',
			description: 'Hypertension',
			isFinal: true,
		});
		const id = added.addDiagnosis.id;
		const updated = await ok(
			doctor.cookie,
			'mutation ($input: UpdateDiagnosisInput!) { updateDiagnosis(input: $input) { isFinal } }',
			{ input: { id, isFinal: true, wiseOrigin: change.origin } },
		);
		expect(updated.updateDiagnosis.isFinal).toBe(true);
		expect(await wiseAudit('diagnosis.update')).toMatchObject({ toolName: 'propose_diagnosis' });

		const remove = await draft('propose_void_diagnosis', { encounterId, icd10Code: 'I10' });
		await ok(doctor.cookie, 'mutation ($input: VoidEntryInput!) { voidDiagnosis(input: $input) { id } }', {
			input: { id, reason: 'Entered in error', wiseOrigin: remove.origin },
		});
		expect(await wiseAudit('diagnosis.void')).toMatchObject({ toolName: 'propose_void_diagnosis' });
		// A card confirms only the change it was drafted for.
		const vitals = await ok(
			doctor.cookie,
			'mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id } }',
			{ input: { encounterId, heartRateBpm: 70 } },
		);
		const wrong = await graphql(
			doctor.cookie,
			'mutation ($input: VoidEntryInput!) { voidVitals(input: $input) { id } }',
			{ input: { id: vitals.recordVitals.id, reason: 'Entered in error', wiseOrigin: change.origin } },
		);
		expect(wrong.body.errors?.[0].message).toMatch(/can't confirm this change/);
	});

	it('voids a vitals entry from a card', async () => {
		const vitals = await ok(
			doctor.cookie,
			'mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id } }',
			{ input: { encounterId, systolicMmHg: 210, diastolicMmHg: 95 } },
		);
		const card = await draft('propose_void_vitals', { encounterId });
		await ok(doctor.cookie, 'mutation ($input: VoidEntryInput!) { voidVitals(input: $input) { id } }', {
			input: { id: vitals.recordVitals.id, reason: 'Typo in systolic', wiseOrigin: card.origin },
		});
		expect(await wiseAudit('vitals.void')).toMatchObject({ toolName: 'propose_void_vitals' });
	});

	it('issues a prescription only after a strong card, then voids it from another', async () => {
		const rx = await ok(
			doctor.cookie,
			'mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { id } }',
			{
				input: {
					encounterId,
					items: [
						{
							genericName: 'Amlodipine',
							strength: '5 mg',
							dose: '1 tablet',
							frequency: 'once a day',
							quantity: 30,
						},
					],
				},
			},
		);
		const id = rx.savePrescription.id;
		const issue = await draft('propose_issue_document', { encounterId, document: 'prescription' });
		const ISSUE =
			'mutation ($id: ID!, $wiseOrigin: WiseOriginInput) { issuePrescription(id: $id, wiseOrigin: $wiseOrigin) { documentStatus } }';
		expect(
			(await ok(doctor.cookie, ISSUE, { id, wiseOrigin: issue.origin })).issuePrescription.documentStatus,
		).toBe('ISSUED');
		expect(await wiseAudit('prescription.issue')).toMatchObject({ toolName: 'propose_issue_document' });

		const voided = await draft('propose_void_document', { encounterId, document: 'prescription' });
		await ok(doctor.cookie, 'mutation ($input: VoidEntryInput!) { voidPrescription(input: $input) { status } }', {
			input: { id, reason: 'Wrong strength', wiseOrigin: voided.origin },
		});
		expect(await wiseAudit('prescription.void')).toMatchObject({ toolName: 'propose_void_document' });
	});

	it("changes the patient's contact details from a card, audited with what changed", async () => {
		const barangay = PSGC_TAGBILARAN_BARANGAYS[0];
		const card = await draft('propose_patient_update', { phone: '0917 555 0100', barangay: barangay.name });
		const res = await ok(
			doctor.cookie,
			'mutation ($input: UpdatePatientInput!) { updatePatient(input: $input) { phone barangay address { barangayCode } } }',
			{ input: { patientId, phone: '0917 555 0100', barangay: barangay.name, wiseOrigin: card.origin } },
		);
		expect(res.updatePatient).toEqual({
			phone: '+639175550100',
			barangay: barangay.name,
			address: { barangayCode: barangay.code },
		});
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { event: 'patient.update' } });
		expect(audit).toMatchObject({ patientId, action: 'UPDATE', entityType: 'Patient' });
		expect(audit.changes).toMatchObject({ after: { phone: '+639175550100', barangay: barangay.name } });
		expect(audit.origin).toMatchObject({ toolName: 'propose_patient_update' });

		const other = await graphql(
			tech.cookie,
			'mutation ($input: UpdatePatientInput!) { updatePatient(input: $input) { phone } }',
			{
				input: { patientId, phone: '0917 000 0000' },
			},
		);
		// The medtech has no lab order of Maria's, so row-level security hides her.
		expect(other.body.errors?.[0].extensions).toMatchObject({ code: 'NOT_FOUND', errorCode: 'ENTITY_NOT_FOUND' });
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
