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

/**
 * Wise actions phase 2 (DESIGN.md §9.4) end to end, with a scripted model: diagnoses, voids, cancelling an order, the
 * lab's worklist steps from a general chat, issuing and voiding a prescription, the bill's steps and contact details.
 * Each card writes nothing; its Confirm goes through the real mutation, settles once, and the audit row records Wise.
 */
describe('Wise actions, phase 2 (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let facilityId = '';
	let labId = '';
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

	const wiseAudit = async (action: string) =>
		(await prisma.auditLog.findFirstOrThrow({ where: { action }, orderBy: { at: 'desc' } })).origin as {
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

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const bautista = await createTestUser(app, { name: 'Lab Bautista', email: 'lab@example.com', password });
		Object.assign(doctor, { cookie: reyes.cookie, id: reyes.userId });
		Object.assign(tech, { cookie: bautista.cookie, id: bautista.userId });
		clinicId = (await ok(doctor.cookie, 'mutation { createClinic(input: { name: "Clinic" }) { id } }')).createClinic
			.id;
		await prisma.clinicMember.create({ data: { clinicId, userId: tech.id, role: 'user' } });
		const [clinic, lab] = await Promise.all([
			prisma.organization.create({ data: { name: 'Health Center', slug: 'hc', type: 'clinic' } }),
			prisma.organization.create({ data: { name: 'Bohol Diagnostics', slug: 'lab', type: 'lab' } }),
		]);
		facilityId = clinic.id;
		labId = lab.id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilityId, userId: doctor.id, role: 'user' },
				{ orgId: labId, userId: tech.id, role: 'user' },
			],
		});
		patientId = (
			await ok(
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
		).registerPatient.patient.id;
		encounterId = (
			await ok(
				doctor.cookie,
				'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
				{
					input: { patientId, facilityId, reason: 'BP check' },
				},
			)
		).createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('adds a diagnosis from a card, changes it from a second one, and voids it from a third', async () => {
		const add = await draft('propose_diagnosis', { encounterId, icd10Code: 'I10', display: 'Hypertension' });
		const added = await ok(
			doctor.cookie,
			'mutation ($input: AddDiagnosisInput!) { addDiagnosis(input: $input) { id certainty } }',
			{ input: { encounterId, icd10Code: 'I10', display: 'Hypertension', wiseOrigin: add.origin } },
		);
		expect(await wiseAudit('diagnosis.add')).toMatchObject({ via: 'wise', toolName: 'propose_diagnosis' });

		const change = await draft('propose_diagnosis', {
			encounterId,
			icd10Code: 'I10',
			display: 'Hypertension',
			certainty: 'confirmed',
		});
		const id = added.addDiagnosis.id;
		const updated = await ok(
			doctor.cookie,
			'mutation ($input: UpdateDiagnosisInput!) { updateDiagnosis(input: $input) { certainty } }',
			{ input: { id, certainty: 'confirmed', wiseOrigin: change.origin } },
		);
		expect(updated.updateDiagnosis.certainty).toBe('confirmed');
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

	it("cancels the doctor's order from a card, and the lab accepts, collects and rejects from its own chat", async () => {
		const orders = await ok(
			doctor.cookie,
			'mutation ($input: CreateEncounterOrdersInput!) { createEncounterOrders(input: $input) { id code } }',
			{ input: { encounterId, codes: ['4548-4', '1558-6', '57698-3'], targetOrgId: labId } },
		);
		const [hba1c, fbs, lipids] = orders.createEncounterOrders.map((order: { id: string }) => order.id);

		const cancel = await draft('propose_cancel_order', { encounterId, test: 'Lipid panel' });
		await ok(doctor.cookie, 'mutation ($input: OrderReasonInput!) { cancelOrder(input: $input) { status } }', {
			input: { orderId: lipids, reason: 'Done last month', wiseOrigin: cancel.origin },
		});
		expect(await wiseAudit('order.cancel')).toMatchObject({ toolName: 'propose_cancel_order' });

		const worklist = await draft('list_lab_orders', {}, 'tech');
		expect(worklist.output.orders.map((order: { id: string }) => order.id).sort()).toEqual([hba1c, fbs].sort());

		const accept = await draft('propose_lab_order_step', { orderId: hba1c, step: 'accept' }, 'tech');
		expect(accept.output).toMatchObject({ subjectId: hba1c });
		expect(accept.output.patientId).toBeUndefined();
		const ACCEPT =
			'mutation ($orderId: ID!, $wiseOrigin: WiseOriginInput) { acceptOrder(orderId: $orderId, wiseOrigin: $wiseOrigin) { status } }';
		expect((await ok(tech.cookie, ACCEPT, { orderId: hba1c, wiseOrigin: accept.origin })).acceptOrder.status).toBe(
			'accepted',
		);
		expect(await wiseAudit('order.accept')).toMatchObject({ toolName: 'propose_lab_order_step' });

		const collect = await draft('propose_lab_order_step', { orderId: hba1c, step: 'collect' }, 'tech');
		const COLLECT =
			'mutation ($orderId: ID!, $wiseOrigin: WiseOriginInput) { markOrderCollected(orderId: $orderId, wiseOrigin: $wiseOrigin) { status } }';
		await ok(tech.cookie, COLLECT, { orderId: hba1c, wiseOrigin: collect.origin });

		const reject = await draft('propose_lab_order_step', { orderId: fbs, step: 'reject' }, 'tech');
		await ok(tech.cookie, 'mutation ($input: OrderReasonInput!) { rejectOrder(input: $input) { status } }', {
			input: { orderId: fbs, reason: 'Patient not fasting', wiseOrigin: reject.origin },
		});
		expect(await wiseAudit('order.reject')).toMatchObject({ toolName: 'propose_lab_order_step' });

		// The doctor's clinic has the lab tools off by default: they are not offered there.
		const settings = await ok(doctor.cookie, 'query { wiseToolSettings { tools { name enabled } } }');
		expect(
			settings.wiseToolSettings.tools.find((tool: { name: string }) => tool.name === 'propose_lab_order_step'),
		).toMatchObject({ enabled: false });
	});

	it('issues a prescription only after a strong card, then voids it from another', async () => {
		await ok(
			doctor.cookie,
			'mutation ($input: UpdateClinicianProfileInput!) { updateMyClinicianProfile(input: $input) { prcLicenseNumber } }',
			{ input: { credentials: 'MD', prcLicenseNumber: '0123456' } },
		);
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
			'mutation ($id: ID!, $wiseOrigin: WiseOriginInput) { issuePrescription(id: $id, wiseOrigin: $wiseOrigin) { status } }';
		expect((await ok(doctor.cookie, ISSUE, { id, wiseOrigin: issue.origin })).issuePrescription.status).toBe(
			'issued',
		);
		expect(await wiseAudit('prescription.issue')).toMatchObject({ toolName: 'propose_issue_document' });

		const voided = await draft('propose_void_document', { encounterId, document: 'prescription' });
		await ok(doctor.cookie, 'mutation ($input: VoidEntryInput!) { voidPrescription(input: $input) { status } }', {
			input: { id, reason: 'Wrong strength', wiseOrigin: voided.origin },
		});
		expect(await wiseAudit('prescription.void')).toMatchObject({ toolName: 'propose_void_document' });
	});

	it('finalizes and marks the bill paid from cards', async () => {
		const bill = await ok(
			doctor.cookie,
			'mutation ($input: SaveEncounterBillInput!) { saveEncounterBill(input: $input) { id } }',
			{
				input: {
					encounterId,
					charges: [{ kind: 'consultation', description: 'Consultation', quantity: 1, unitPrice: 300 }],
				},
			},
		);
		const id = bill.saveEncounterBill.id;
		const finalize = await draft('propose_bill_step', { encounterId, step: 'finalize' });
		const FINALIZE =
			'mutation ($id: ID!, $wiseOrigin: WiseOriginInput) { finalizeEncounterBill(id: $id, wiseOrigin: $wiseOrigin) { status } }';
		await ok(doctor.cookie, FINALIZE, { id, wiseOrigin: finalize.origin });
		expect(await wiseAudit('bill.finalize')).toMatchObject({ toolName: 'propose_bill_step' });

		const pay = await draft('propose_bill_step', { encounterId, step: 'pay', orNumber: 'OR-1001' });
		const paid = await ok(
			doctor.cookie,
			'mutation ($input: MarkBillPaidInput!) { markEncounterBillPaid(input: $input) { status orNumber } }',
			{ input: { id, orNumber: 'OR-1001', wiseOrigin: pay.origin } },
		);
		expect(paid.markEncounterBillPaid).toEqual({ status: 'paid', orNumber: 'OR-1001' });
		expect(await wiseAudit('bill.pay')).toMatchObject({ toolName: 'propose_bill_step' });
	});

	it("changes the patient's contact details from a card, audited with what changed", async () => {
		const card = await draft('propose_patient_update', { phone: '0917 555 0100', barangay: 'Cogon' });
		const res = await ok(
			doctor.cookie,
			'mutation ($input: UpdatePatientInput!) { updatePatient(input: $input) { phone barangay } }',
			{ input: { patientId, phone: '0917 555 0100', barangay: 'Cogon', wiseOrigin: card.origin } },
		);
		expect(res.updatePatient).toEqual({ phone: '0917 555 0100', barangay: 'Cogon' });
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'patient.update' } });
		expect(audit).toMatchObject({ patientId, reason: 'Changed phone, barangay' });
		expect(audit.origin).toMatchObject({ toolName: 'propose_patient_update' });

		const other = await graphql(
			tech.cookie,
			'mutation ($input: UpdatePatientInput!) { updatePatient(input: $input) { phone } }',
			{
				input: { patientId, phone: '000' },
			},
		);
		// The lab sees Maria (it ran her tests), but contact details are kept by care facilities.
		expect(other.body.errors?.[0].message).toMatch(/clinic or hospital/);
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
