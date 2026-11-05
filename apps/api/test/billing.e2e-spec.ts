import crypto from 'node:crypto';

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { BillingModule } from '../src/clinical/billing/billing.module.js';
import type { BillingActor } from '../src/clinical/billing/billing-access.js';
import { EncounterBillingService } from '../src/clinical/billing/invoices/encounter-billing.service.js';
import { InvoiceService } from '../src/clinical/billing/invoices/invoice.service.js';
import { PaymentService } from '../src/clinical/billing/payments/payment.service.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { ConfigModule } from '../src/config/config.module.js';
import type { ServiceItem } from '../src/generated/prisma/client.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createEncounter,
	createUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

/** The guards module (pulled in through Wise tool settings) needs an `AuthService`; the services are called directly. */
@Global()
@Module({ providers: [{ provide: AuthService, useValue: {} }], exports: [AuthService] })
class StubAuthModule {}

@Module({ imports: [ConfigModule, PrismaModule, StubAuthModule, BillingModule] })
class BillingTestModule {}

/** Rejection → the mapped GraphQL error (`code`, `errorCode`, message). */
const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error('expected a failure');
		},
		(error: unknown) => mapError(error),
	);

/**
 * The cashier desk on the reference's Invoice model: the doctor drafts the visit's invoice from the clinic's price
 * list, the desk issues it (numbered), takes the PhilHealth package and the cash balance, and voids with a reason.
 * Row-level security, the `invoices_lock` trigger and the audit trail are checked against Postgres.
 */
describe('billing (e2e)', () => {
	let prisma: PrismaService;
	let invoices: InvoiceService;
	let payments: PaymentService;
	let billing: EncounterBillingService;
	let scene: ClinicScene;
	let doctor: BillingActor;
	let cashier: BillingActor;
	let consultation: ServiceItem;
	let cbg: ServiceItem;
	let paracetamol: ServiceItem;
	let seniorIdId: string;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [BillingTestModule] }).compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		prisma = app.get(PrismaService);
		invoices = app.get(InvoiceService);
		payments = app.get(PaymentService);
		billing = app.get(EncounterBillingService);

		scene = await createClinicScene(prisma);
		const cashierUser = await createUser(prisma, { firstName: 'Carla', lastName: 'Dela Cruz' });
		await grantClinicRoles(prisma, scene.clinic.id, cashierUser.id, ['CASHIER']);
		doctor = { userId: scene.doctor.id, clinicId: scene.clinic.id, userRole: 'user', staffRoles: ['DOCTOR'] };
		cashier = { userId: cashierUser.id, clinicId: scene.clinic.id, userRole: 'user', staffRoles: ['CASHIER'] };

		const item = (code: string, name: string, data: Partial<ServiceItem> & { price: number }) =>
			prisma.serviceItem.create({
				data: {
					organizationId: scene.organization.id,
					code,
					name,
					category: data.category ?? 'CONSULTATION',
					defaultPrice: data.price + 50,
					taxType: data.taxType ?? 'VAT_EXEMPT',
					diagnosticTestId: data.diagnosticTestId ?? null,
					clinicPrices: { create: { clinicId: scene.clinic.id, price: data.price } },
				},
			});
		const test = await prisma.diagnosticTest.create({
			data: {
				organizationId: scene.organization.id,
				code: 'CBG',
				name: 'Capillary blood glucose',
				category: 'LABORATORY',
			},
		});
		consultation = await item('CONSULT', 'Consultation', { price: 300 });
		cbg = await item('CBG', 'Capillary blood glucose', {
			price: 80,
			category: 'LABORATORY',
			diagnosticTestId: test.id,
		});
		paracetamol = await item('PCM', 'Paracetamol 500 mg tablet', {
			price: 2.5,
			category: 'MEDICINE',
			taxType: 'VATABLE',
		});
		await prisma.diagnosticOrder.create({
			data: {
				orderNo: 'LAB-TEST-1',
				encounterId: scene.encounter.id,
				items: { create: { testId: test.id } },
			},
		});
		seniorIdId = (
			await prisma.patientIdentification.create({
				data: { patientId: scene.patient.id, type: 'SENIOR_CITIZEN_OSCA', idNumber: 'OSCA-TAG-0042' },
			})
		).id;
	});

	afterAll(async () => {
		await prisma?.$disconnect();
	});

	it('starts the visit with the consultation and the tests ordered, at the clinic price', async () => {
		const view = await billing.get(doctor, scene.encounter.id);
		expect(view).toMatchObject({ invoices: [], canDraft: true, canCollect: false });
		expect(view.suggestedLines).toEqual([
			{
				serviceItemId: consultation.id,
				description: 'Consultation',
				quantity: 1,
				unitPrice: 300,
				taxType: 'VAT_EXEMPT',
			},
			{
				serviceItemId: cbg.id,
				description: 'Capillary blood glucose',
				quantity: 1,
				unitPrice: 80,
				taxType: 'VAT_EXEMPT',
			},
		]);
		expect(view.discountIdentifications).toEqual([
			{ id: seniorIdId, discountType: 'SENIOR_CITIZEN', idNumber: 'OSCA-TAG-0042' },
		]);
		expect((await billing.get(cashier, scene.encounter.id)).canCollect).toBe(true);
	});

	it('drafts one invoice per visit, matching lines to the price list, and replaces the draft', async () => {
		const draft = await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			lines: [
				{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 },
				{ description: 'paracetamol 500 mg tablet', quantity: 10, unitPrice: 2.5, taxType: 'VAT_EXEMPT' },
			],
		});
		expect(draft).toMatchObject({ status: 'DRAFT', invoiceNo: null, buyerName: 'Maria Santos', grossAmount: 325 });
		// Matched by name: the catalog item's VATable tax type wins over the one sent.
		expect(draft.lines[1]).toMatchObject({ serviceItemId: paracetamol.id, taxType: 'VATABLE', vatAmount: 2.68 });
		expect(draft).toMatchObject({ vatableSales: 22.32, vatAmount: 2.68, vatExemptSales: 300, netAmount: 325 });
		expect(draft.lines[0]).toMatchObject({ encounterId: scene.encounter.id });

		const replaced = await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			expectedVersion: draft.version,
			lines: [
				{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 },
				{ serviceItemId: cbg.id, description: 'Capillary blood glucose', quantity: 1, unitPrice: 80 },
			],
		});
		expect(replaced).toMatchObject({ id: draft.id, grossAmount: 380, netAmount: 380 });
		expect(await prisma.invoice.count({ where: { encounterId: scene.encounter.id } })).toBe(1);

		expect(
			await failure(
				invoices.saveDraft(doctor, {
					encounterId: scene.encounter.id,
					expectedVersion: draft.version,
					lines: [{ description: 'Consultation', quantity: 1, unitPrice: 300 }],
				}),
			),
		).toMatchObject({ code: 'CONFLICT', errorCode: 'STALE_VERSION' });
		expect(
			await prisma.auditLog.count({
				where: { entityId: draft.id, event: { in: ['invoice.create', 'invoice.update'] } },
			}),
		).toBe(2);
	});

	it('applies the senior citizen discount with the ID presented, linked to the ID on file (RA 9994)', async () => {
		const current = (await billing.get(doctor, scene.encounter.id)).invoices[0];
		expect(
			await failure(
				invoices.saveDraft(doctor, {
					encounterId: scene.encounter.id,
					expectedVersion: current.version,
					lines: [
						{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 },
					],
					discountType: 'SENIOR_CITIZEN',
				}),
			),
		).toMatchObject({ code: 'BAD_REQUEST', errorCode: 'INVALID_BILLING_INPUT' });

		const discounted = await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			expectedVersion: current.version,
			lines: [
				{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 },
				{ serviceItemId: cbg.id, description: 'Capillary blood glucose', quantity: 1, unitPrice: 80 },
			],
			discountType: 'SENIOR_CITIZEN',
			discountIdNumber: 'osca tag 0042',
		});
		expect(discounted).toMatchObject({ scPwdDiscount: 76, netAmount: 304 });
		expect(discounted.discounts).toEqual([
			expect.objectContaining({
				type: 'SENIOR_CITIZEN',
				rate: 0.2,
				amount: 76,
				identificationId: seniorIdId,
				beneficiaryName: 'Maria Santos',
				idNumber: 'osca tag 0042',
			}),
		]);

		// Back to the full price for the rest of the flow.
		await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			expectedVersion: discounted.version,
			lines: [
				{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 },
				{ serviceItemId: cbg.id, description: 'Capillary blood glucose', quantity: 1, unitPrice: 80 },
			],
		});
	});

	it('issues from the document sequence, then locks the invoice (invoices_lock)', async () => {
		const draft = (await billing.get(doctor, scene.encounter.id)).invoices[0];
		const year = new Date(Date.now() + 8 * 3600 * 1000).getUTCFullYear();
		const issued = await invoices.issue(doctor, { id: draft.id, expectedVersion: draft.version });
		expect(issued).toMatchObject({
			status: 'ISSUED',
			invoiceNo: `${scene.clinic.code}-SI-${year}-000001`,
			balance: 380,
			amountPaid: 0,
		});
		expect(await failure(invoices.issue(doctor, { id: draft.id }))).toMatchObject({
			errorCode: 'INVOICE_ALREADY_ISSUED',
		});
		expect(
			await failure(
				invoices.saveDraft(doctor, {
					encounterId: scene.encounter.id,
					lines: [{ description: 'Consultation', quantity: 1, unitPrice: 300 }],
				}),
			),
		).toMatchObject({ errorCode: 'INVOICE_ALREADY_ISSUED' });
		// Postgres refuses the edit too, whoever makes it.
		expect(
			await failure(prisma.invoice.update({ where: { id: draft.id }, data: { grossAmount: 1 } })),
		).toMatchObject({ code: 'CONFLICT', errorCode: 'CHECK_VIOLATION' });
		expect(
			await failure(prisma.invoiceLine.updateMany({ where: { invoiceId: draft.id }, data: { unitPrice: 1 } })),
		).toMatchObject({ errorCode: 'CHECK_VIOLATION' });
	});

	it('takes the PhilHealth package, then the cash balance with change', async () => {
		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		expect(
			await failure(
				payments.record(cashier, { invoiceId: invoice.id, method: 'CASH', amount: 500, referenceNo: 'OR-1' }),
			),
		).toMatchObject({ errorCode: 'PAYMENT_EXCEEDS_BALANCE' });

		const partly = await payments.record(cashier, {
			invoiceId: invoice.id,
			method: 'PHILHEALTH',
			amount: 300,
			referenceNo: 'KONSULTA',
		});
		expect(partly).toMatchObject({ status: 'PARTIALLY_PAID', amountPaid: 300, balance: 80 });

		const paid = await payments.record(cashier, {
			invoiceId: invoice.id,
			method: 'CASH',
			amount: 80,
			tenderedAmount: 100,
			referenceNo: 'OR-0000123',
		});
		expect(paid).toMatchObject({ status: 'PAID', amountPaid: 380, balance: 0 });
		expect(paid.payments).toMatchObject([
			{ method: 'PHILHEALTH', amount: 300, referenceNo: 'KONSULTA', status: 'POSTED' },
			{ method: 'CASH', amount: 80, tenderedAmount: 100, changeAmount: 20, referenceNo: 'OR-0000123' },
		]);
		expect(paid.payments[0].paymentNo).toMatch(/-PAY-\d{4}-000001$/);
		expect(
			await failure(
				payments.record(cashier, { invoiceId: invoice.id, method: 'CASH', amount: 1, referenceNo: 'OR-2' }),
			),
		).toMatchObject({ code: 'CONFLICT' });
		expect(await prisma.auditLog.count({ where: { event: 'payment.record', userId: cashier.userId } })).toBe(2);
	});

	it('voids with a reason, voids its payments, and lets the visit be billed again', async () => {
		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		expect(await failure(invoices.void(cashier, { id: invoice.id, reason: 'x' }))).toMatchObject({
			code: 'BAD_REQUEST',
		});
		const voided = await invoices.void(cashier, { id: invoice.id, reason: 'Wrong patient charged' });
		expect(voided).toMatchObject({ status: 'VOID', voidReason: 'Wrong patient charged' });
		expect(voided.payments.every((payment) => payment.status === 'VOIDED')).toBe(true);
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: invoice.id, event: 'invoice.void' } }),
		).toMatchObject({
			action: 'VOID',
			reason: 'Wrong patient charged',
			patientId: scene.patient.id,
		});
		expect(await failure(invoices.void(cashier, { id: invoice.id, reason: 'Again please' }))).toMatchObject({
			errorCode: 'INVOICE_VOIDED',
		});

		const again = await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			lines: [{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 }],
		});
		expect(again.id).not.toBe(invoice.id);
		expect((await billing.get(doctor, scene.encounter.id)).invoices.map((row) => row.status)).toEqual([
			'DRAFT',
			'VOID',
		]);
	});

	it('numbers from an active BIR series, and refuses to issue once it runs out', async () => {
		const series = await prisma.invoiceSeries.create({
			data: { clinicId: scene.clinic.id, prefix: 'SI-', startNo: 1, endNo: 999, nextNo: 999, isActive: true },
		});
		const draft = (await billing.get(doctor, scene.encounter.id)).invoices[0];
		expect(await invoices.issue(doctor, { id: draft.id })).toMatchObject({ invoiceNo: 'SI-999', status: 'ISSUED' });
		expect(await prisma.invoice.findUnique({ where: { id: draft.id } })).toMatchObject({ seriesId: series.id });

		await invoices.void(cashier, { id: draft.id, reason: 'Testing the series' });
		const next = await invoices.saveDraft(doctor, {
			encounterId: scene.encounter.id,
			lines: [{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 }],
		});
		expect(await failure(invoices.issue(doctor, { id: next.id }))).toMatchObject({
			errorCode: 'INVOICE_SERIES_EXHAUSTED',
		});
		await prisma.invoiceSeries.update({ where: { id: series.id }, data: { isActive: false } });
	});

	it('saves, issues and pays from Wise cards, each confirmed once, about this patient only', async () => {
		const admin: BillingActor = {
			userId: scene.admin.id,
			clinicId: scene.clinic.id,
			userRole: 'admin',
			staffRoles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
		};
		const visit = await createEncounter(prisma, { clinicId: scene.clinic.id, patientId: scene.patient.id });
		const chat = await prisma.chat.create({
			data: { userId: admin.userId, clinicId: scene.clinic.id, surface: 'patient', patientId: scene.patient.id },
		});
		const card = async (toolName: string) => {
			const toolCallId = `call_${crypto.randomUUID()}`;
			await prisma.chatMessage.create({
				data: {
					chatId: chat.id,
					role: 'assistant',
					parts: {
						create: {
							order: 0,
							type: `tool-${toolName}`,
							toolCallId,
							toolName,
							toolState: 'output-available',
						},
					},
				},
			});
			return { chatId: chat.id, toolCallId, toolName, edited: false };
		};
		const lines = [{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 }];

		const charges = await card('propose_charges');
		const draft = await invoices.saveDraft(admin, { encounterId: visit.id, lines, wiseOrigin: charges });
		expect(
			await prisma.wiseProposalOutcome.findUnique({ where: { toolCallId: charges.toolCallId } }),
		).toMatchObject({ status: 'confirmed', entityId: draft.id });
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: draft.id, event: 'invoice.create' } }),
		).toMatchObject({ origin: { via: 'wise', toolName: 'propose_charges' } });
		expect(
			await failure(invoices.saveDraft(admin, { encounterId: visit.id, lines, wiseOrigin: charges })),
		).toMatchObject({ code: 'CONFLICT' });
		// A new card for an existing draft must say which version it changes.
		expect(
			await failure(
				invoices.saveDraft(admin, { encounterId: visit.id, lines, wiseOrigin: await card('propose_charges') }),
			),
		).toMatchObject({ errorCode: 'STALE_VERSION' });
		// propose_charges can't issue.
		expect(
			await failure(invoices.issue(admin, { id: draft.id, wiseOrigin: await card('propose_charges') })),
		).toMatchObject({ code: 'BAD_REQUEST' });

		const issued = await invoices.issue(admin, { id: draft.id, wiseOrigin: await card('propose_bill_step') });
		expect(issued.status).toBe('ISSUED');
		const paid = await payments.record(admin, {
			invoiceId: draft.id,
			method: 'GCASH',
			amount: 300,
			referenceNo: 'GC-998877',
			wiseOrigin: await card('propose_bill_step'),
		});
		expect(paid).toMatchObject({ status: 'PAID', balance: 0 });

		// A card from another patient's chart chat can't confirm a change about Maria.
		const other = await prisma.patient.create({
			data: {
				organizationId: scene.organization.id,
				patientNo: `P-${crypto.randomUUID().slice(0, 8)}`,
				firstName: 'Other',
				lastName: 'Patient',
				sex: 'MALE',
				birthDate: new Date('1970-01-01T00:00:00Z'),
			},
		});
		const otherChat = await prisma.chat.create({
			data: { userId: admin.userId, clinicId: scene.clinic.id, surface: 'patient', patientId: other.id },
		});
		const toolCallId = `call_${crypto.randomUUID()}`;
		await prisma.chatMessage.create({
			data: {
				chatId: otherChat.id,
				role: 'assistant',
				parts: {
					create: {
						order: 0,
						type: 'tool-propose_bill_step',
						toolCallId,
						toolName: 'propose_bill_step',
						toolState: 'output-available',
					},
				},
			},
		});
		expect(
			await failure(
				invoices.void(admin, {
					id: draft.id,
					reason: 'Wrong chart',
					wiseOrigin: { chatId: otherChat.id, toolCallId, toolName: 'propose_bill_step', edited: false },
				}),
			),
		).toMatchObject({ code: 'BAD_REQUEST' });
	});

	it('keeps other doctors and other clinics out', async () => {
		const outsider: BillingActor = { ...doctor, userId: scene.otherDoctor.id };
		expect(await failure(billing.get(outsider, scene.encounter.id))).toMatchObject({ code: 'NOT_FOUND' });
		expect(
			await failure(
				invoices.saveDraft(outsider, {
					encounterId: scene.encounter.id,
					lines: [{ description: 'Consultation', quantity: 1, unitPrice: 300 }],
				}),
			),
		).toMatchObject({ code: 'NOT_FOUND' });

		const branch = await createClinic(prisma, {
			organizationId: scene.organization.id,
			staff: [{ userId: scene.doctor.id, roles: ['DOCTOR'] }],
		});
		const elsewhere = await createEncounter(prisma, { clinicId: branch.id, patientId: scene.patient.id });
		expect(
			await failure(
				invoices.saveDraft(doctor, {
					encounterId: elsewhere.id,
					lines: [{ description: 'Consultation', quantity: 1, unitPrice: 300 }],
				}),
			),
		).toMatchObject({ code: 'FORBIDDEN', errorCode: 'WRONG_CLINIC' });
		expect((await billing.get(doctor, elsewhere.id)).canDraft).toBe(false);
	});
});
