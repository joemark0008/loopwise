import { describe, expect, it } from 'vitest';
import {
	idNumberOnFile,
	invoiceFormFrom,
	invoiceFormTotals,
	emptyTender,
	paymentFormFrom,
	remainingToTender,
	toRecordPaymentInput,
	toRecordPaymentsInput,
	toSaveInvoiceDraftInput,
	validateInvoiceForm,
	validatePaymentForm,
} from './billing-form-values';
import type { EncounterBillingFieldsFragment, InvoiceFieldsFragment } from '@/graphql/generated/graphql';

const invoice = (overrides: Partial<InvoiceFieldsFragment> = {}): InvoiceFieldsFragment => ({
	id: 'i1',
	version: 3,
	encounterId: 'e1',
	seriesId: null,
	invoiceNo: null,
	invoiceDate: '2026-11-05T00:00:00.000Z',
	status: 'DRAFT',
	buyerName: 'Maria Santos',
	lines: [
		{
			id: 'l1',
			serviceItemId: 's1',
			serviceItemCode: 'CONSULT',
			category: 'CONSULTATION',
			description: 'Consultation',
			quantity: 1,
			unitPrice: 300,
			taxType: 'VAT_EXEMPT',
			vatAmount: 0,
			discountAmount: 60,
			lineTotal: 240,
			isProfessionalFee: true,
			practitionerId: 'pr1',
			practitionerName: 'Dr. Jose Reyes',
			scPwdEligible: true,
		},
	],
	discounts: [
		{
			id: 'd1',
			type: 'SENIOR_CITIZEN',
			rate: 0.2,
			amount: 60,
			vatExempted: 0,
			beneficiaryName: 'Maria Santos',
			idNumber: 'OSCA-1',
			identificationId: 'pi9',
			approvedById: 'u1',
		},
	],
	payments: [],
	grossAmount: 300,
	vatableSales: 0,
	vatExemptSales: 300,
	zeroRatedSales: 0,
	vatAmount: 0,
	lessVatScPwd: 0,
	scPwdDiscount: 60,
	otherDiscount: 0,
	withholdingTax: 0,
	withholdingTaxRate: 0,
	netAmount: 240,
	amountPaid: 0,
	balance: 240,
	issuedAt: null,
	voidedAt: null,
	voidReason: null,
	createdAt: '2026-11-05T00:00:00.000Z',
	...overrides,
});

const billing = (overrides: Partial<EncounterBillingFieldsFragment> = {}): EncounterBillingFieldsFragment => ({
	encounterId: 'e1',
	clinicId: 'c1',
	patientId: 'p1',
	vatRegistered: true,
	canDraft: true,
	canCollect: false,
	canVoid: false,
	openShiftId: null,
	discountApprovers: [{ userId: 'u1', name: 'Ana Admin', types: ['EMPLOYEE', 'PROMO', 'SPECIAL'] }],
	invoices: [],
	priceList: [
		{
			id: 's1',
			code: 'CONSULT',
			name: 'Consultation',
			category: 'CONSULTATION',
			price: 300,
			taxType: 'VAT_EXEMPT',
			isPfShareable: true,
		},
	],
	suggestedLines: [
		{
			source: 'CONSULTATION',
			serviceItemId: 's1',
			description: 'Consultation',
			quantity: 1,
			unitPrice: 300,
			taxType: 'VAT_EXEMPT',
			practitionerId: 'pr1',
			isProfessionalFee: true,
		},
		{
			source: 'DIAGNOSTIC',
			serviceItemId: null,
			description: 'Lipid profile',
			quantity: 1,
			unitPrice: 0,
			taxType: 'VAT_EXEMPT',
			practitionerId: null,
			isProfessionalFee: false,
		},
	],
	discountIdentifications: [{ id: 'pi1', discountType: 'PWD', idNumber: 'PWD-0042', expiresAt: null }],
	...overrides,
});

const NO_OTHER = {
	otherDiscountType: '',
	otherDiscountMode: 'percent',
	otherDiscountValue: '',
	otherDiscountApprovedById: '',
	withholdingTaxRate: '',
};

describe('billing form values', () => {
	it("starts a new invoice from the visit's charges, leaving unknown prices blank", () => {
		const values = invoiceFormFrom(billing());
		expect(values).toEqual({
			lines: [
				{
					serviceItemId: 's1',
					description: 'Consultation',
					quantity: '1',
					unitPrice: '300',
					taxType: 'VAT_EXEMPT',
					category: 'CONSULTATION',
					practitionerId: 'pr1',
				},
				{
					serviceItemId: '',
					description: 'Lipid profile',
					quantity: '1',
					unitPrice: '',
					taxType: 'VAT_EXEMPT',
					category: '',
					practitionerId: '',
				},
			],
			discountType: '',
			discountIdentificationId: '',
			discountIdNumber: '',
			...NO_OTHER,
		});
		expect(validateInvoiceForm(values)['lines.1.unitPrice']).toBeDefined();
	});

	it('edits the draft with its discount, and saves against its version', () => {
		const values = invoiceFormFrom(billing({ invoices: [invoice()] }));
		expect(values).toMatchObject({ discountType: 'SENIOR_CITIZEN', discountIdentificationId: 'pi9' });
		expect(invoiceFormTotals(values)).toMatchObject({ grossAmount: 300, scPwdDiscount: 60, netAmount: 240 });
		expect(toSaveInvoiceDraftInput('e1', values, 3)).toEqual({
			encounterId: 'e1',
			lines: [
				{
					serviceItemId: 's1',
					description: 'Consultation',
					quantity: 1,
					unitPrice: 300,
					taxType: 'VAT_EXEMPT',
					practitionerId: 'pr1',
				},
			],
			discountType: 'SENIOR_CITIZEN',
			discountIdentificationId: 'pi9',
			discountIdNumber: null,
			otherDiscountType: null,
			otherDiscountPercent: null,
			otherDiscountAmount: null,
			otherDiscountApprovedById: null,
			withholdingTaxRate: null,
			expectedVersion: 3,
		});
	});

	it('asks for the ID shown, finds the one on file, and needs an approver for another discount', () => {
		const values = { ...invoiceFormFrom(billing()), discountType: 'PWD' as const };
		expect(validateInvoiceForm({ ...values, lines: values.lines.slice(0, 1) }).discountIdNumber).toMatch(/ID/);
		expect(idNumberOnFile(billing(), 'PWD')).toBe('PWD-0042');
		expect(idNumberOnFile(billing(), 'SENIOR_CITIZEN')).toBe('');
		const other = {
			...invoiceFormFrom(billing()),
			lines: values.lines.slice(0, 1),
			otherDiscountType: 'EMPLOYEE' as const,
			otherDiscountValue: '10',
		};
		expect(validateInvoiceForm(other).otherDiscountApprovedById).toMatch(/approved/);
		expect(invoiceFormTotals({ ...other, otherDiscountApprovedById: 'u1' })).toMatchObject({
			otherDiscount: 30,
			netAmount: 270,
		});
	});

	it('pays the balance by default, splits tenders and refuses more than the balance', () => {
		const issued = invoice({ status: 'ISSUED', invoiceNo: 'SI-1', version: 4 });
		const values = paymentFormFrom(issued);
		expect(values.tenders).toHaveLength(1);
		expect(values.tenders[0].amount).toBe('240');
		const split = {
			tenders: [
				{ ...values.tenders[0], amount: '140', tenderedAmount: '200' },
				{ ...emptyTender('GCASH', '100'), referenceNo: 'GC-1' },
			],
		};
		expect(validatePaymentForm(split, issued.balance)).toEqual({});
		expect(remainingToTender({ tenders: [split.tenders[0]] }, issued.balance)).toBe(100);
		expect(
			validatePaymentForm({ tenders: [...split.tenders, emptyTender('MAYA', '1')] }, issued.balance).total,
		).toMatch(/more than the balance/);
		expect(validatePaymentForm({ tenders: [emptyTender('GCASH', '10')] }, issued.balance)).toHaveProperty(
			'tenders.0.referenceNo',
		);
		expect(toRecordPaymentsInput(issued, split)).toEqual({
			invoiceId: 'i1',
			expectedVersion: 4,
			tenders: [
				{
					method: 'CASH',
					amount: 140,
					tenderedAmount: 200,
					referenceNo: null,
					bankName: null,
					checkDate: null,
				},
				{
					method: 'GCASH',
					amount: 100,
					tenderedAmount: null,
					referenceNo: 'GC-1',
					bankName: null,
					checkDate: null,
				},
			],
		});
		expect(
			toRecordPaymentInput(issued, { ...emptyTender('PHILHEALTH', '240'), referenceNo: 'KONSULTA' }),
		).toMatchObject({ method: 'PHILHEALTH', tenderedAmount: null, referenceNo: 'KONSULTA', expectedVersion: 4 });
	});
});
