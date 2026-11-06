import { CASH_DENOMINATIONS } from '@loopwise/shared/invoice';
import { LAB_TESTS } from '@loopwise/shared/lab-tests';

import { InvoiceTotalsService, type PricedLine } from '../src/clinical/billing/invoices/invoice-totals.service.js';
import { professionalFeeAmounts } from '../src/clinical/billing/professional-fees/professional-fee-amounts.js';
import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import { Prisma, type ServiceCategory, type TaxType } from '../src/generated/prisma/client.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG, DEMO_STAFF, demoEncounterOf } from './seed-clinical.js';

/**
 * The demo's billing (synthetic): the organization's price list (`ServiceItem`) with the TAG clinic's prices, an
 * active BIR invoice series for TAG, and Maria Santos's first full visit billed and paid: consultation and capillary
 * blood glucose, PhilHealth Konsulta covering ₱300 (a PHILHEALTH payment), the ₱80 balance paid in cash.
 * Prices are invented, not a real fee schedule; the ATP permit number is fake.
 */

interface CatalogItem {
	code: string;
	name: string;
	category: ServiceCategory;
	price: number;
	taxType?: TaxType;
	isPfShareable?: boolean;
}

/** Services, medicines and supplies (VAT-inclusive prices where VATABLE). */
const CATALOG: readonly CatalogItem[] = [
	{ code: 'CONSULT', name: 'Consultation', category: 'CONSULTATION', price: 300, isPfShareable: true },
	{ code: 'CONSULT-FU', name: 'Follow-up consultation', category: 'CONSULTATION', price: 200, isPfShareable: true },
	{ code: 'CBG', name: 'Capillary blood glucose', category: 'LABORATORY', price: 80 },
	{ code: 'DRESSING', name: 'Wound dressing', category: 'PROCEDURE', price: 150 },
	{ code: 'NEB', name: 'Nebulization', category: 'PROCEDURE', price: 200 },
	{ code: 'MEDCERT', name: 'Medical certificate', category: 'CERTIFICATE', price: 100 },
	// Medicines for diabetes and hypertension are VAT-exempt (RA 10963 / RA 11534); others are VATable.
	{ code: 'MED-METFORMIN-500', name: 'Metformin 500 mg tablet', category: 'MEDICINE', price: 3 },
	{ code: 'MED-LOSARTAN-50', name: 'Losartan 50 mg tablet', category: 'MEDICINE', price: 10 },
	{ code: 'MED-AMOX-500', name: 'Amoxicillin 500 mg capsule', category: 'MEDICINE', price: 8, taxType: 'VATABLE' },
	{ code: 'MED-PCM-500', name: 'Paracetamol 500 mg tablet', category: 'MEDICINE', price: 2.5, taxType: 'VATABLE' },
	{ code: 'SUP-GAUZE', name: 'Sterile gauze pad', category: 'SUPPLY', price: 15, taxType: 'VATABLE' },
];

/** Lab and imaging prices by LOINC code; tests without one get the default for their category. */
const TEST_PRICES: Record<string, number> = {
	'4548-4': 450,
	'1558-6': 120,
	'57698-3': 550,
	'58410-2': 200,
	'2160-0': 180,
	'3084-1': 180,
	'1742-6': 200,
	'2823-3': 220,
	'24356-8': 100,
	'11545-1': 250,
	'11524-6': 400,
	'36643-5': 500,
	'24606-6': 1800,
	'24601-7': 1500,
};

/** Seeds the price list, TAG's invoice series and Maria's paid first visit. Runs once, on the fresh demo. */
export async function seedBilling(tx: Prisma.TransactionClient): Promise<void> {
	const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
	const clinic = await tx.clinic.findFirstOrThrow({
		where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
	});

	const items = new Map<string, { id: string; name: string; price: number; taxType: TaxType }>();
	const addItem = async (item: CatalogItem & { diagnosticTestId?: string }) => {
		const created = await tx.serviceItem.create({
			data: {
				organizationId: organization.id,
				code: item.code,
				name: item.name,
				category: item.category,
				defaultPrice: item.price,
				taxType: item.taxType ?? 'VAT_EXEMPT',
				isPfShareable: item.isPfShareable ?? false,
				diagnosticTestId: item.diagnosticTestId ?? null,
				clinicPrices: { create: { clinicId: clinic.id, price: item.price } },
			},
		});
		items.set(item.code, {
			id: created.id,
			name: created.name,
			price: item.price,
			taxType: created.taxType,
		});
	};
	for (const item of CATALOG) {
		await addItem(item);
	}

	// The diagnostics catalog's tests, priced by LOINC; the shared test list fills in any the catalog lacks.
	const tests = await tx.diagnosticTest.findMany({
		where: { organizationId: organization.id, isActive: true },
		orderBy: { name: 'asc' },
	});
	const isImaging = (category: string) => category === 'IMAGING' || category === 'CARDIO';
	const priceOf = (loinc: string | null, imaging: boolean) =>
		(loinc ? TEST_PRICES[loinc] : undefined) ?? (imaging ? 600 : 350);
	for (const test of tests) {
		await addItem({
			code: `DX-${test.code}`,
			name: test.name,
			category: isImaging(test.category) ? 'IMAGING' : 'LABORATORY',
			price: priceOf(test.lisCode, isImaging(test.category)),
			diagnosticTestId: test.id,
		});
	}
	const billedCodes = new Set(tests.map((test) => test.code));
	for (const test of LAB_TESTS.filter((labTest) => !billedCodes.has(labTest.code))) {
		await addItem({
			code: `DX-${test.code}`,
			name: test.display,
			category: isImaging(test.category) ? 'IMAGING' : 'LABORATORY',
			price: priceOf(test.loinc, isImaging(test.category)),
		});
	}

	const series = await tx.invoiceSeries.create({
		data: {
			clinicId: clinic.id,
			docType: 'SALES_INVOICE',
			prefix: 'SI-',
			startNo: 1,
			endNo: 50_000,
			nextNo: 1,
			permitNo: 'ATP-DEMO-0001',
			permitDate: new Date('2026-01-05T00:00:00Z'),
			isActive: true,
		},
	});

	await billMariasFirstVisit(tx, {
		clinic,
		seriesId: series.id,
		items: [items.get('CONSULT'), items.get('CBG')].flatMap((item) => (item ? [item] : [])),
	});
}

async function billMariasFirstVisit(
	tx: Prisma.TransactionClient,
	opts: {
		clinic: { id: string; code: string };
		seriesId: string;
		items: { id: string; name: string; price: number; taxType: TaxType }[];
	},
): Promise<void> {
	const visit = await demoEncounterOf(tx, 'maria');
	if (!visit) {
		return;
	}
	const patient = await tx.patient.findUniqueOrThrow({ where: { id: visit.patientId } });
	const cashier = await tx.user.findUniqueOrThrow({ where: { email: DEMO_STAFF.cashier }, select: { id: true } });
	const doctor = await tx.user.findUnique({ where: { email: DEMO_STAFF.doctor }, select: { id: true } });
	const sequences = new DocumentSequenceService(new DocumentSequenceRepository());

	const lines: PricedLine[] = opts.items.map((item) => ({
		serviceItemId: item.id,
		description: item.name,
		quantity: 1,
		unitPrice: item.price,
		taxType: item.taxType,
		scPwdEligible: true,
	}));
	const organization = await tx.organization.findFirstOrThrow({
		where: { clinics: { some: { id: opts.clinic.id } } },
		select: { vatRegistration: true },
	});
	const amounts = new InvoiceTotalsService().compute(lines, {
		vatRegistered: organization.vatRegistration === 'VAT',
	});
	const issuedAt = new Date(visit.startedAt.getTime() + 60 * 60 * 1000);
	const series = await tx.invoiceSeries.update({ where: { id: opts.seriesId }, data: { nextNo: { increment: 1 } } });

	const invoice = await tx.invoice.create({
		data: {
			clinicId: opts.clinic.id,
			encounterId: visit.id,
			buyerName: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
			createdById: doctor?.id ?? null,
			...amounts.invoice,
			lines: {
				createMany: {
					data: lines.map((line, index) => ({
						serviceItemId: line.serviceItemId,
						encounterId: visit.id,
						practitionerId: index === 0 ? visit.practitionerId : null,
						// The consultation is Dr. Reyes's professional fee (a PF-shareable item).
						isProfessionalFee: index === 0,
						description: line.description,
						quantity: line.quantity,
						unitPrice: line.unitPrice,
						taxType: line.taxType,
						sortOrder: index,
						vatAmount: amounts.lines[index].vatAmount,
						discountAmount: amounts.lines[index].discountAmount,
						lineTotal: amounts.lines[index].lineTotal,
					})),
				},
			},
		},
	});
	// Issued from the series (the `invoices_lock` trigger lets only payments and voiding move after this).
	await tx.invoice.update({
		where: { id: invoice.id },
		data: {
			status: 'ISSUED',
			seriesId: opts.seriesId,
			invoiceNo: `SI-${String(series.nextNo - 1).padStart(String(series.endNo).length, '0')}`,
			invoiceDate: issuedAt,
			issuedAt,
		},
	});

	// The consultation's professional fee, from the issued invoice (as `ProfessionalFeeService` does on issue).
	const consultLine = await tx.invoiceLine.findFirst({ where: { invoiceId: invoice.id, isProfessionalFee: true } });
	if (consultLine?.practitionerId) {
		const terms = await tx.practitionerClinic.findUnique({
			where: {
				practitionerId_clinicId: { practitionerId: consultLine.practitionerId, clinicId: opts.clinic.id },
			},
		});
		await tx.professionalFee.create({
			data: {
				practitionerId: consultLine.practitionerId,
				invoiceLineId: consultLine.id,
				encounterId: visit.id,
				...professionalFeeAmounts(consultLine, terms),
				createdAt: issuedAt,
			},
		});
	}

	// PhilHealth Konsulta covers the consultation; Maria pays the balance in cash, on the cashier's shift of that day
	// (closed with its Z reading).
	const cashAmount = amounts.invoice.netAmount.minus(300);
	const openingCash = new Prisma.Decimal(1000);
	const shift = await tx.cashierShift.create({
		data: {
			clinicId: opts.clinic.id,
			cashierId: cashier.id,
			openedAt: new Date(issuedAt.getTime() - 2 * 60 * 60 * 1000),
			closedAt: new Date(issuedAt.getTime() + 6 * 60 * 60 * 1000),
			closedById: cashier.id,
			openingCash,
			expectedCash: openingCash.plus(cashAmount),
			countedCash: openingCash.plus(cashAmount),
			variance: 0,
			denominations: denominationsOf(openingCash.plus(cashAmount)),
			remarks: null,
		},
	});
	const payments = [
		{
			method: 'PHILHEALTH' as const,
			amount: new Prisma.Decimal(300),
			referenceNo: 'KONSULTA',
			tenderedAmount: null,
		},
		{
			method: 'CASH' as const,
			amount: cashAmount,
			referenceNo: 'OR-0000123',
			tenderedAmount: new Prisma.Decimal(100),
		},
	];
	let paid = new Prisma.Decimal(0);
	for (const payment of payments) {
		await tx.payment.create({
			data: {
				paymentNo: await sequences.next(tx, opts.clinic, 'PAYMENT', issuedAt),
				clinicId: opts.clinic.id,
				cashierShiftId: shift.id,
				method: payment.method,
				amount: payment.amount,
				tenderedAmount: payment.tenderedAmount,
				changeAmount: payment.tenderedAmount === null ? null : payment.tenderedAmount.minus(payment.amount),
				referenceNo: payment.referenceNo,
				receivedAt: issuedAt,
				receivedById: cashier.id,
				allocations: { create: { invoiceId: invoice.id, amount: payment.amount } },
			},
		});
		paid = paid.plus(payment.amount);
		const balance = amounts.invoice.netAmount.minus(paid);
		await tx.invoice.update({
			where: { id: invoice.id },
			data: { amountPaid: paid, balance, status: balance.isZero() ? 'PAID' : 'PARTIALLY_PAID' },
		});
	}
}

/** Bills and coins making up `total`, largest first (the seeded Z reading's count). */
export function denominationsOf(total: Prisma.Decimal): Record<string, number> {
	let centavos = total.times(100).toNumber();
	const counts: Record<string, number> = {};
	for (const denomination of CASH_DENOMINATIONS) {
		const unit = Math.round(denomination * 100);
		const count = Math.floor(centavos / unit);
		if (count > 0) {
			counts[String(denomination)] = count;
			centavos -= count * unit;
		}
	}
	return counts;
}
