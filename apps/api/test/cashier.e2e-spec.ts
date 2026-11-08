import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { BillingModule } from '../src/clinical/billing/billing.module.js';
import type { BillingActor } from '../src/clinical/billing/billing-access.js';
import { CashierDeskService } from '../src/clinical/billing/cashier-desk/cashier-desk.service.js';
import { CashierShiftService } from '../src/clinical/billing/cashier-shifts/cashier-shift.service.js';
import { InvoiceChargesService } from '../src/clinical/billing/charges/invoice-charges.service.js';
import { InvoiceSeriesService } from '../src/clinical/billing/invoice-series/invoice-series.service.js';
import { EncounterBillingService } from '../src/clinical/billing/invoices/encounter-billing.service.js';
import { InvoiceService } from '../src/clinical/billing/invoices/invoice.service.js';
import { InvoicePrintService } from '../src/clinical/billing/invoices/invoice-print.service.js';
import { PaymentService } from '../src/clinical/billing/payments/payment.service.js';
import { ProfessionalFeeService } from '../src/clinical/billing/professional-fees/professional-fee.service.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { ConfigModule } from '../src/config/config.module.js';
import type { ServiceItem } from '../src/generated/prisma/client.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	type ClinicScene,
	createClinicScene,
	createEncounter,
	createPractitioner,
	createUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

@Global()
@Module({ providers: [{ provide: AuthService, useValue: {} }], exports: [AuthService] })
class StubAuthModule {}

@Module({ imports: [ConfigModule, PrismaModule, StubAuthModule, BillingModule] })
class CashierTestModule {}

const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error('expected a failure');
		},
		(error: unknown) => mapError(error),
	);

const manilaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * The cashier desk end to end against Postgres: load charges from the visit (consult fee, tests, the pharmacy's
 * dispensed medicines through the billing port), the SC/PWD discount from the ID on file and an approved discount,
 * the BIR series, issuing with professional fees, split tender on a cashier shift, X and Z readings, voids by the
 * clinic admin, the printed invoice and the desk's (and Wise's) reads.
 */
describe('cashier desk (e2e)', () => {
	let prisma: PrismaService;
	let invoices: InvoiceService;
	let charges: InvoiceChargesService;
	let billing: EncounterBillingService;
	let payments: PaymentService;
	let shifts: CashierShiftService;
	let series: InvoiceSeriesService;
	let fees: ProfessionalFeeService;
	let printer: InvoicePrintService;
	let desk: CashierDeskService;
	let scene: ClinicScene;
	let doctor: BillingActor;
	let cashier: BillingActor;
	let otherCashier: BillingActor;
	let billingAdmin: BillingActor;
	let consultation: ServiceItem;
	let certificate: ServiceItem;
	let seniorIdId: string;
	let dispenseId: string;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [CashierTestModule] }).compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		prisma = app.get(PrismaService);
		invoices = app.get(InvoiceService);
		charges = app.get(InvoiceChargesService);
		billing = app.get(EncounterBillingService);
		payments = app.get(PaymentService);
		shifts = app.get(CashierShiftService);
		series = app.get(InvoiceSeriesService);
		fees = app.get(ProfessionalFeeService);
		printer = app.get(InvoicePrintService);
		desk = app.get(CashierDeskService);

		scene = await createClinicScene(prisma);
		await prisma.organization.update({
			where: { id: scene.organization.id },
			data: {
				vatRegistration: 'VAT',
				name: 'Tagbilaran Health Corp.',
				tradeName: 'Tagbilaran HC',
				tin: '123-456-789-000',
			},
		});
		await prisma.clinic.update({ where: { id: scene.clinic.id }, data: { birBranchCode: '00001' } });
		const actor = async (firstName: string, roles: ('CASHIER' | 'ADMIN')[]): Promise<BillingActor> => {
			const user = await createUser(prisma, { firstName, lastName: 'Desk' });
			await grantClinicRoles(prisma, scene.clinic.id, user.id, roles);
			return {
				userId: user.id,
				clinicId: scene.clinic.id,
				userRole: roles.includes('ADMIN') ? 'admin' : 'user',
				staffRoles: roles,
			};
		};
		cashier = await actor('Carla', ['CASHIER']);
		otherCashier = await actor('Nina', ['CASHIER']);
		// An admin outside the care team: they void and release without seeing the patient's chart.
		billingAdmin = await actor('Bea', ['ADMIN']);
		doctor = { userId: scene.doctor.id, clinicId: scene.clinic.id, userRole: 'user', staffRoles: ['DOCTOR'] };

		// Dr. Reyes's own consult fee and fee terms here: EWT 5%, the clinic keeps 20%.
		await prisma.practitionerClinic.update({
			where: {
				practitionerId_clinicId: { practitionerId: scene.doctorPractitioner.id, clinicId: scene.clinic.id },
			},
			data: { consultFee: 450, ewtRate: 0.05, clinicShareRate: 0.2 },
		});
		const item = (code: string, name: string, data: Partial<ServiceItem> & { price: number }) =>
			prisma.serviceItem.create({
				data: {
					organizationId: scene.organization.id,
					code,
					name,
					category: data.category ?? 'CONSULTATION',
					defaultPrice: data.price,
					taxType: data.taxType ?? 'VAT_EXEMPT',
					isPfShareable: data.isPfShareable ?? false,
					diagnosticTestId: data.diagnosticTestId ?? null,
					inventoryItemId: data.inventoryItemId ?? null,
					...(data.category === 'CERTIFICATE'
						? {}
						: { clinicPrices: { create: { clinicId: scene.clinic.id, price: data.price } } }),
				},
			});
		consultation = await item('CONSULT', 'Consultation', { price: 300, isPfShareable: true });
		certificate = await item('MEDCERT', 'Medical certificate', { price: 100, category: 'CERTIFICATE' });
		const fbs = await prisma.diagnosticTest.create({
			data: {
				organizationId: scene.organization.id,
				code: 'FBS',
				name: 'Fasting blood sugar',
				category: 'LABORATORY',
			},
		});
		await item('DX-FBS', 'Fasting blood sugar', { price: 150, category: 'LABORATORY', diagnosticTestId: fbs.id });
		const amoxicillin = await prisma.inventoryItem.create({
			data: {
				organizationId: scene.organization.id,
				sku: 'AMOX-500',
				name: 'Amoxicillin 500 mg capsule',
				category: 'MEDICINE',
				genericName: 'Amoxicillin',
				strength: '500 mg',
				unitOfMeasure: 'capsule',
			},
		});
		await item('MED-AMOX', 'Amoxicillin 500 mg capsule', {
			price: 8,
			category: 'MEDICINE',
			taxType: 'VATABLE',
			inventoryItemId: amoxicillin.id,
		});
		// The pharmacy dispensed 21 capsules at the visit (its append-only ledger; the billing hook reads it).
		dispenseId = (
			await prisma.stockMovement.create({
				data: {
					clinicId: scene.clinic.id,
					itemId: amoxicillin.id,
					type: 'DISPENSE',
					quantity: -21,
					encounterId: scene.encounter.id,
				},
			})
		).id;
		await prisma.diagnosticOrder.create({
			data: { orderNo: 'LAB-CASHIER-1', encounterId: scene.encounter.id, items: { create: { testId: fbs.id } } },
		});
		seniorIdId = (
			await prisma.patientIdentification.create({
				data: { patientId: scene.patient.id, type: 'SENIOR_CITIZEN_OSCA', idNumber: 'OSCA-TAG-0099' },
			})
		).id;
		await prisma.patientIdentification.create({
			data: {
				patientId: scene.patient.id,
				type: 'PWD',
				idNumber: 'PWD-OLD-1',
				expiresAt: new Date('2020-01-01T00:00:00Z'),
			},
		});
	});

	afterAll(async () => {
		await prisma?.$disconnect();
	});

	it('loads the charges of the visit: the consult fee, the tests and the medicines dispensed', async () => {
		const draft = await charges.load(cashier, { encounterId: scene.encounter.id });
		expect(draft.lines).toMatchObject([
			{
				serviceItemId: consultation.id,
				unitPrice: 450,
				practitionerId: scene.doctorPractitioner.id,
				isProfessionalFee: true,
			},
			{ description: 'Fasting blood sugar', unitPrice: 150, isProfessionalFee: false, practitionerId: null },
			{
				description: 'Amoxicillin 500 mg capsule',
				quantity: 21,
				unitPrice: 8,
				taxType: 'VATABLE',
				stockMovementIds: [dispenseId],
			},
		]);
		// 450 + 150 exempt; 168 VAT-inclusive → 150 net + 18 VAT.
		expect(draft).toMatchObject({ grossAmount: 768, vatExemptSales: 600, vatableSales: 150, vatAmount: 18 });

		// A line added by hand survives loading again; the visit's charges are not doubled.
		const withCertificate = await invoices.saveDraft(cashier, {
			encounterId: scene.encounter.id,
			expectedVersion: draft.version,
			lines: [
				...draft.lines.map((line) => ({ ...line, practitionerId: line.practitionerId })),
				{ serviceItemId: certificate.id, description: 'Medical certificate', quantity: 1, unitPrice: 100 },
			],
		});
		const reloaded = await charges.load(cashier, {
			encounterId: scene.encounter.id,
			expectedVersion: withCertificate.version,
		});
		expect(reloaded.lines.map((line) => line.description)).toEqual([
			'Consultation',
			'Fasting blood sugar',
			'Amoxicillin 500 mg capsule',
			'Medical certificate',
		]);
		// Loading again adds nothing: the dispensed medicine is one line, its ledger row kept on it.
		expect(reloaded.lines.filter((line) => line.stockMovementIds.includes(dispenseId))).toHaveLength(1);
		expect(
			await failure(charges.load(cashier, { encounterId: scene.encounter.id, expectedVersion: 1 })),
		).toMatchObject({
			errorCode: 'STALE_VERSION',
		});
	});

	it('gives the senior citizen discount only from an ID on file, not expired, on the eligible lines', async () => {
		const current = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		const lines = current.lines.map((line) => ({
			serviceItemId: line.serviceItemId,
			description: line.description,
			quantity: line.quantity,
			unitPrice: line.unitPrice,
			practitionerId: line.practitionerId,
		}));
		const save = (extra: object) =>
			invoices.saveDraft(cashier, { encounterId: scene.encounter.id, lines, ...extra });
		expect(
			await failure(save({ discountType: 'SENIOR_CITIZEN', discountIdNumber: 'OSCA-NOT-MINE' })),
		).toMatchObject({
			errorCode: 'DISCOUNT_ID_NOT_ON_FILE',
		});
		expect(await failure(save({ discountType: 'PWD', discountIdNumber: 'PWD-OLD-1' }))).toMatchObject({
			errorCode: 'DISCOUNT_ID_EXPIRED',
		});
		const discounted = await save({ discountType: 'SENIOR_CITIZEN', discountIdentificationId: seniorIdId });
		// Eligible: 450 + 150 exempt → 120 off; amoxicillin 168 → VAT 18 removed, 30 off; the certificate stays at 100.
		expect(discounted).toMatchObject({
			grossAmount: 868,
			lessVatScPwd: 18,
			scPwdDiscount: 150,
			vatExemptSales: 850,
			vatableSales: 0,
			netAmount: 700,
		});
		expect(discounted.discounts[0]).toMatchObject({
			type: 'SENIOR_CITIZEN',
			identificationId: seniorIdId,
			idNumber: 'OSCA-TAG-0099',
			beneficiaryName: 'Maria Santos',
			approvedById: cashier.userId,
		});
		expect(discounted.lines.find((line) => line.description === 'Medical certificate')).toMatchObject({
			scPwdEligible: false,
			lineTotal: 100,
		});

		// Another discount needs an approver allowed to give it, and is never on top of SC/PWD.
		expect(
			await failure(
				save({
					otherDiscountType: 'EMPLOYEE',
					otherDiscountPercent: 10,
					otherDiscountApprovedById: doctor.userId,
				}),
			),
		).toMatchObject({ errorCode: 'DISCOUNT_APPROVER_INVALID' });
		expect(
			await failure(
				save({
					discountType: 'SENIOR_CITIZEN',
					discountIdentificationId: seniorIdId,
					otherDiscountType: 'PROMO',
					otherDiscountAmount: 50,
					otherDiscountApprovedById: billingAdmin.userId,
				}),
			),
		).toMatchObject({ errorCode: 'INVALID_BILLING_INPUT' });
		const special = await save({
			otherDiscountType: 'SPECIAL',
			otherDiscountAmount: 68,
			otherDiscountApprovedById: doctor.userId,
		});
		expect(special).toMatchObject({ otherDiscount: 68, netAmount: 800 });
		expect(special.discounts[0]).toMatchObject({
			type: 'SPECIAL',
			rate: 0,
			amount: 68,
			approvedById: doctor.userId,
		});

		// Back to the senior discount for the rest of the flow.
		await save({ discountType: 'SENIOR_CITIZEN', discountIdentificationId: seniorIdId });
	});

	it('registers BIR series (admins), refuses an overlap, and issues from the series', async () => {
		const permit = { permitNo: 'ATP-TEST-1', permitDate: '2026-01-05' };
		const created = await series.create(billingAdmin, { prefix: 'SI-', startNo: 1, endNo: 500, ...permit });
		expect(created).toMatchObject({ state: 'ACTIVE', remaining: 500, firstNumber: 'SI-001' });
		expect(
			await failure(series.create(billingAdmin, { prefix: 'SI-', startNo: 400, endNo: 900, ...permit })),
		).toMatchObject({ errorCode: 'INVOICE_SERIES_OVERLAP' });

		const draft = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		const issued = await invoices.issue(cashier, { id: draft.id, expectedVersion: draft.version });
		expect(issued).toMatchObject({ status: 'ISSUED', invoiceNo: 'SI-001', seriesId: created.id, balance: 700 });
		expect((await series.list(cashier))[0]).toMatchObject({ nextNo: 2, remaining: 499 });
		// The issued invoice bills the dispensed capsules: they are no longer a charge to load.
		const view = await billing.get(cashier, scene.encounter.id);
		expect(view.suggestedLines.map((line) => line.source)).toEqual(['CONSULTATION', 'DIAGNOSTIC']);
	});

	it("creates the doctor's professional fee on issue: share, EWT and net payable", async () => {
		const report = await fees.report(billingAdmin, { from: manilaToday() });
		expect(report.doctors).toHaveLength(1);
		// Consultation ₱450 − 20% SC = ₱360 gross; clinic 20% = ₱72; EWT 5% of ₱288 = ₱14.40; net ₱273.60.
		expect(report.doctors[0]).toMatchObject({
			practitionerId: scene.doctorPractitioner.id,
			count: 1,
			grossAmount: 360,
			clinicShare: 72,
			ewtAmount: 14.4,
			netPayable: 273.6,
			unreleased: 273.6,
		});
		expect(report.doctors[0].fees[0]).toMatchObject({ invoiceNo: 'SI-001', ewtRate: 0.05, status: 'UNPAID' });
		// A doctor sees their own fees only.
		const outsider: BillingActor = { ...doctor, userId: scene.otherDoctor.id };
		expect((await fees.report(outsider, { from: manilaToday() })).doctors).toEqual([]);
		expect((await fees.report(doctor, { from: manilaToday() })).doctors).toHaveLength(1);
	});

	it('takes a split tender on the open shift, never more than the balance', async () => {
		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		expect(
			await failure(
				shifts.open(cashier, { openingCash: 1000 }).then(() => shifts.open(cashier, { openingCash: 1 })),
			),
		).toMatchObject({
			errorCode: 'SHIFT_ALREADY_OPEN',
		});
		const tender = { invoiceId: invoice.id };
		expect(
			await failure(
				payments.recordSplit(cashier, {
					...tender,
					tenders: [{ method: 'CHECK', amount: 100, referenceNo: 'CHK-1' }],
				}),
			),
		).toMatchObject({ errorCode: 'INVALID_BILLING_INPUT' });
		expect(
			await failure(
				payments.recordSplit(cashier, {
					...tender,
					tenders: [
						{ method: 'CASH', amount: 500 },
						{ method: 'GCASH', amount: 300, referenceNo: 'GC-1' },
					],
				}),
			),
		).toMatchObject({ errorCode: 'PAYMENT_EXCEEDS_BALANCE' });

		const partly = await payments.recordSplit(cashier, {
			...tender,
			tenders: [
				{ method: 'CASH', amount: 250, tenderedAmount: 500 },
				{ method: 'GCASH', amount: 200, referenceNo: 'GC-778899' },
				{ method: 'CHECK', amount: 100, referenceNo: 'CHK-0042', bankName: 'BPI', checkDate: '2026-11-06' },
			],
		});
		expect(partly).toMatchObject({ status: 'PARTIALLY_PAID', amountPaid: 550, balance: 150 });
		expect(partly.payments).toMatchObject([
			{ method: 'CASH', amount: 250, tenderedAmount: 500, changeAmount: 250, referenceNo: null },
			{ method: 'GCASH', referenceNo: 'GC-778899' },
			{ method: 'CHECK', bankName: 'BPI', checkDate: '2026-11-06' },
		]);
		const shift = await shifts.current(cashier);
		expect(partly.payments.every((payment) => payment.cashierShiftId === shift?.id)).toBe(true);
		expect(new Set(partly.payments.map((payment) => payment.paymentNo)).size).toBe(3);

		const paid = await payments.record(cashier, {
			invoiceId: invoice.id,
			method: 'MAYA',
			amount: 150,
			referenceNo: 'MY-1',
		});
		expect(paid).toMatchObject({ status: 'PAID', balance: 0 });
	});

	it('gives the X reading by method, and lets an admin void a payment while the shift is open', async () => {
		const shift = (await shifts.current(cashier))!;
		const reading = await shifts.xReading(cashier, shift.id);
		expect(reading).toMatchObject({
			isOpen: true,
			openingCash: 1000,
			cashCollected: 250,
			expectedCash: 1250,
			totalCollected: 700,
		});
		// In the order of the payment methods.
		expect(reading.byMethod.map((total) => [total.method, total.amount])).toEqual([
			['CASH', 250],
			['GCASH', 200],
			['MAYA', 150],
			['CHECK', 100],
		]);
		expect(await failure(shifts.xReading(otherCashier, shift.id))).toMatchObject({ errorCode: 'SHIFT_NOT_YOURS' });

		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		const maya = invoice.payments.find((payment) => payment.method === 'MAYA')!;
		expect(await failure(payments.void(billingAdmin, { paymentId: maya.id, reason: 'x' }))).toMatchObject({
			code: 'BAD_REQUEST',
		});
		const back = await payments.void(billingAdmin, { paymentId: maya.id, reason: 'Keyed the wrong reference' });
		expect(back).toMatchObject({ status: 'PARTIALLY_PAID', amountPaid: 550, balance: 150 });
		expect(back.payments.find((payment) => payment.id === maya.id)).toMatchObject({ status: 'VOIDED' });
		expect(
			await failure(payments.void(billingAdmin, { paymentId: maya.id, reason: 'Again please' })),
		).toMatchObject({
			errorCode: 'PAYMENT_NOT_POSTED',
		});
		expect(await prisma.auditLog.findFirst({ where: { entityId: maya.id, event: 'payment.void' } })).toMatchObject({
			action: 'VOID',
			userId: billingAdmin.userId,
			reason: 'Keyed the wrong reference',
		});
		await payments.record(cashier, { invoiceId: invoice.id, method: 'CASH', amount: 150, tenderedAmount: 200 });
	});

	it('closes the shift with the Z reading: counted cash, expected cash and variance', async () => {
		const shift = (await shifts.current(cashier))!;
		expect(
			await failure(shifts.close(cashier, { shiftId: shift.id, denominations: [{ denomination: 3, count: 1 }] })),
		).toMatchObject({ code: 'BAD_REQUEST' });
		// Expected: ₱1,000 float + ₱250 + ₱150 cash = ₱1,400. Counted ₱1,380: short ₱20.
		const closed = await shifts.close(cashier, {
			shiftId: shift.id,
			denominations: [
				{ denomination: 1000, count: 1 },
				{ denomination: 100, count: 3 },
				{ denomination: 50, count: 1 },
				{ denomination: 20, count: 1 },
				{ denomination: 5, count: 2 },
			],
			remarks: 'Short ₱20, to check with the supervisor',
		});
		expect(closed).toMatchObject({ isOpen: false, expectedCash: 1400, countedCash: 1380, variance: -20 });
		expect(closed.denominations[0]).toEqual({ denomination: 1000, count: 1 });
		expect(await failure(shifts.close(cashier, { shiftId: shift.id, denominations: [] }))).toMatchObject({
			errorCode: 'SHIFT_CLOSED',
		});
		expect(await shifts.current(cashier)).toBeNull();
		// A payment of a closed shift is not voided; and no payment without an open shift.
		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		expect(
			await failure(payments.void(billingAdmin, { paymentId: invoice.payments[0].id, reason: 'Too late now' })),
		).toMatchObject({ errorCode: 'PAYMENT_IN_CLOSED_SHIFT' });
		expect(await prisma.auditLog.count({ where: { entityId: shift.id, event: 'cashier_shift.z_reading' } })).toBe(
			1,
		);
	});

	it('prints the BIR sales invoice with the seller, the permit and the SC details', async () => {
		const invoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		const printed = await printer.get(cashier, invoice.id);
		expect(printed.seller).toMatchObject({
			registeredName: 'Tagbilaran Health Corp.',
			tradeName: 'Tagbilaran HC',
			tin: '123-456-789-000',
			vatRegistered: true,
			birBranchCode: '00001',
		});
		expect(printed.permit).toMatchObject({
			permitNo: 'ATP-TEST-1',
			permitDate: '2026-01-05',
			range: 'SI-001 – SI-500',
		});
		expect(printed.invoice).toMatchObject({
			invoiceNo: 'SI-001',
			status: 'PAID',
			lessVatScPwd: 18,
			scPwdDiscount: 150,
		});
		expect(await prisma.auditLog.count({ where: { entityId: invoice.id, event: 'invoice.print' } })).toBe(1);
	});

	it('reads the desk: collections by method, open invoices, for the desk and for Wise', async () => {
		const today = await desk.desk(cashier);
		expect(today.totalCollected).toBe(700);
		expect(today.collections.find((total) => total.method === 'CASH')).toMatchObject({ count: 2, amount: 400 });
		const wise = await desk.forWise(cashier.userId, scene.clinic.id, { view: 'collections' });
		expect(wise).toMatchObject({ view: 'collections', totalCollected: 700 });
		expect(await failure(desk.forWise(doctor.userId, scene.clinic.id, { view: 'collections' }))).toMatchObject({
			code: 'FORBIDDEN',
		});
		// The doctor sees their patient's open invoices (row-level security picks the patient).
		const visit = await createEncounter(prisma, {
			clinicId: scene.clinic.id,
			patientId: scene.patient.id,
			practitionerId: scene.doctorPractitioner.id,
		});
		await charges.load(doctor, { encounterId: visit.id });
		const open = await desk.forWise(doctor.userId, scene.clinic.id, {
			view: 'open_invoices',
			chartPatientId: scene.patient.id,
		});
		expect(open.openInvoices).toMatchObject([
			{ status: 'DRAFT', buyerName: 'Maria Santos', encounterId: visit.id },
		]);
		expect(await desk.forWise(cashier.userId, scene.clinic.id, { view: 'shift' })).toMatchObject({ shift: null });
	});

	it("lets the clinic admin release fees and void invoices whose patient they don't see", async () => {
		const report = await fees.report(billingAdmin, { from: manilaToday() });
		const fee = report.doctors[0].fees[0];
		const released = await fees.release(billingAdmin, { ids: [fee.id], releaseRef: 'CHK-PF-0001' });
		expect(released.doctors[0].fees[0]).toMatchObject({ status: 'RELEASED', releaseRef: 'CHK-PF-0001' });
		expect(await failure(fees.release(billingAdmin, { ids: [fee.id], releaseRef: 'CHK-PF-0002' }))).toMatchObject({
			code: 'CONFLICT',
		});

		const paidInvoice = (await billing.get(cashier, scene.encounter.id)).invoices[0];
		expect(
			await failure(invoices.void(billingAdmin, { id: paidInvoice.id, reason: 'Wrong patient' })),
		).toMatchObject({
			errorCode: 'PROFESSIONAL_FEE_RELEASED',
		});

		// A fresh visit: issued, then voided by the admin; the number stays used and the fee is cancelled.
		const visit = await createEncounter(prisma, {
			clinicId: scene.clinic.id,
			patientId: scene.patient.id,
			practitionerId: scene.doctorPractitioner.id,
		});
		const draft = await charges.load(cashier, { encounterId: visit.id });
		const issued = await invoices.issue(cashier, { id: draft.id });
		expect(issued.invoiceNo).toBe('SI-002');
		const voided = await invoices.void(billingAdmin, { id: issued.id, reason: 'Patient left before paying' });
		expect(voided).toMatchObject({ status: 'VOID', invoiceNo: 'SI-002', voidReason: 'Patient left before paying' });
		expect(await prisma.invoice.findUnique({ where: { id: issued.id } })).toMatchObject({
			voidedById: billingAdmin.userId,
		});
		expect(await prisma.professionalFee.findFirst({ where: { encounterId: visit.id } })).toMatchObject({
			status: 'CANCELLED',
		});
	});

	it('refuses to issue once the series has expired or run out', async () => {
		const all = await series.list(billingAdmin);
		await series.update(billingAdmin, { id: all[0].id, validUntil: '2026-01-31' });
		const visit = await createEncounter(prisma, {
			clinicId: scene.clinic.id,
			patientId: scene.patient.id,
			practitionerId: scene.doctorPractitioner.id,
		});
		const draft = await charges.load(cashier, { encounterId: visit.id });
		expect(await failure(invoices.issue(cashier, { id: draft.id }))).toMatchObject({
			errorCode: 'INVOICE_SERIES_EXPIRED',
		});
		const lastOne = await series.create(billingAdmin, {
			prefix: 'SI-',
			startNo: 501,
			endNo: 501,
			permitNo: 'ATP-TEST-2',
			permitDate: '2026-06-01',
		});
		expect(await invoices.issue(cashier, { id: draft.id })).toMatchObject({
			invoiceNo: 'SI-501',
			seriesId: lastOne.id,
		});
		const another = await createEncounter(prisma, { clinicId: scene.clinic.id, patientId: scene.patient.id });
		const next = await invoices.saveDraft(cashier, {
			encounterId: another.id,
			lines: [{ serviceItemId: consultation.id, description: 'Consultation', quantity: 1, unitPrice: 300 }],
		});
		expect(await failure(invoices.issue(cashier, { id: next.id }))).toMatchObject({
			errorCode: 'INVOICE_SERIES_EXHAUSTED',
		});
		// With every series turned off, issuing is refused, not given an internal (unregistered) number.
		const registered = await series.list(billingAdmin);
		for (const each of registered) {
			await series.update(billingAdmin, { id: each.id, isActive: false });
		}
		expect(await failure(invoices.issue(cashier, { id: next.id }))).toMatchObject({
			errorCode: 'INVOICE_SERIES_INACTIVE',
		});
		for (const each of registered) {
			await series.update(billingAdmin, { id: each.id, isActive: each.isActive });
		}
		// A doctor outside the clinic's practitioners can't be named on a line.
		const stranger = await createPractitioner(prisma, {});
		expect(
			await failure(
				invoices.saveDraft(cashier, {
					encounterId: another.id,
					expectedVersion: next.version,
					lines: [
						{
							serviceItemId: consultation.id,
							description: 'Consultation',
							quantity: 1,
							unitPrice: 300,
							practitionerId: stranger.id,
						},
					],
				}),
			),
		).toMatchObject({ errorCode: 'LINE_PRACTITIONER_INVALID' });
	});
});
