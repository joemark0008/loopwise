import { describe, expect, it } from 'vitest';
import {
	idNumberOnFile,
	invoiceFormFrom,
	invoiceFormTotals,
	paymentFormFrom,
	toRecordPaymentInput,
	toSaveInvoiceDraftInput,
	validateInvoiceForm,
	validatePaymentForm,
} from './billing-form-values';
import type { EncounterBillingFieldsFragment, InvoiceFieldsFragment } from '@/graphql/generated/graphql';

const invoice = (overrides: Partial<InvoiceFieldsFragment> = {}): InvoiceFieldsFragment => ({
	id: 'i1',
	version: 3,
	encounterId: 'e1',
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
			identificationId: null,
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
	canDraft: true,
	canCollect: false,
	invoices: [],
	priceList: [
		{
			id: 's1',
			code: 'CONSULT',
			name: 'Consultation',
			category: 'CONSULTATION',
			price: 300,
			taxType: 'VAT_EXEMPT',
		},
	],
	suggestedLines: [
		{ serviceItemId: 's1', description: 'Consultation', quantity: 1, unitPrice: 300, taxType: 'VAT_EXEMPT' },
		{ serviceItemId: null, description: 'Lipid profile', quantity: 1, unitPrice: 0, taxType: 'VAT_EXEMPT' },
	],
	discountIdentifications: [{ id: 'pi1', discountType: 'PWD', idNumber: 'PWD-0042' }],
	...overrides,
});

describe('billing form values', () => {
	it('starts a new invoice from the suggested lines, leaving unknown prices blank', () => {
		const values = invoiceFormFrom(billing());
		expect(values).toEqual({
			lines: [
				{
					serviceItemId: 's1',
					description: 'Consultation',
					quantity: '1',
					unitPrice: '300',
					taxType: 'VAT_EXEMPT',
				},
				{
					serviceItemId: '',
					description: 'Lipid profile',
					quantity: '1',
					unitPrice: '',
					taxType: 'VAT_EXEMPT',
				},
			],
			discountType: '',
			discountIdNumber: '',
		});
		expect(validateInvoiceForm(values)['lines.1.unitPrice']).toBeDefined();
	});

	it('edits the draft with its discount, and saves against its version', () => {
		const values = invoiceFormFrom(billing({ invoices: [invoice()] }));
		expect(values).toMatchObject({ discountType: 'SENIOR_CITIZEN', discountIdNumber: 'OSCA-1' });
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
				},
			],
			discountType: 'SENIOR_CITIZEN',
			discountIdNumber: 'OSCA-1',
			expectedVersion: 3,
		});
	});

	it('asks for the ID number of a discount, and finds the one on file', () => {
		const values = { ...invoiceFormFrom(billing()), discountType: 'PWD' as const };
		expect(validateInvoiceForm({ ...values, lines: values.lines.slice(0, 1) }).discountIdNumber).toMatch(
			/ID number/,
		);
		expect(idNumberOnFile(billing(), 'PWD')).toBe('PWD-0042');
		expect(idNumberOnFile(billing(), 'SENIOR_CITIZEN')).toBe('');
	});

	it('pays the balance by default and refuses more than it', () => {
		const issued = invoice({ status: 'ISSUED', invoiceNo: 'SI-1', version: 4 });
		const values = { ...paymentFormFrom(issued), referenceNo: 'OR-1', tenderedAmount: '500' };
		expect(values.amount).toBe('240');
		expect(validatePaymentForm(values, issued.balance)).toEqual({});
		expect(validatePaymentForm({ ...values, amount: '300', tenderedAmount: '' }, issued.balance).amount).toMatch(
			/more than the balance/,
		);
		expect(toRecordPaymentInput(issued, values)).toEqual({
			invoiceId: 'i1',
			method: 'CASH',
			amount: 240,
			tenderedAmount: 500,
			referenceNo: 'OR-1',
			expectedVersion: 4,
		});
		expect(
			toRecordPaymentInput(issued, { ...values, method: 'PHILHEALTH', referenceNo: 'KONSULTA' }),
		).toMatchObject({ method: 'PHILHEALTH', tenderedAmount: null, referenceNo: 'KONSULTA' });
	});
});
