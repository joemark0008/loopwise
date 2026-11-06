import { describe, expect, it } from 'vitest';

import {
	changeDue,
	computeInvoiceTotals,
	countedCash,
	InvoiceDraftSchema,
	PaymentDraftSchema,
	paymentOutcome,
	SplitPaymentSchema,
} from './invoice';

describe('invoice rules', () => {
	it('parses a draft and asks for the SC/PWD ID number', () => {
		const line = { description: 'Consultation', quantity: '1', unitPrice: '300' };
		expect(InvoiceDraftSchema.parse({ lines: [line], discountType: '' })).toMatchObject({
			lines: [{ quantity: 1, unitPrice: 300, taxType: 'VAT_EXEMPT' }],
			discountType: undefined,
		});
		expect(InvoiceDraftSchema.safeParse({ lines: [] }).success).toBe(false);
		const noId = InvoiceDraftSchema.safeParse({ lines: [line], discountType: 'SENIOR_CITIZEN' });
		expect(noId.success).toBe(false);
		expect(noId.error?.issues[0]).toMatchObject({ path: ['discountIdNumber'] });
		const other = { lines: [line], otherDiscountType: 'EMPLOYEE', otherDiscountPercent: '10' };
		expect(InvoiceDraftSchema.safeParse(other).error?.issues[0]).toMatchObject({
			path: ['otherDiscountApprovedById'],
		});
		const approved = { ...other, otherDiscountApprovedById: '01900000-0000-7000-8000-000000000001' };
		expect(InvoiceDraftSchema.safeParse(approved).success).toBe(true);
		expect(InvoiceDraftSchema.safeParse({ ...approved, otherDiscountAmount: '5' }).success).toBe(false);
		expect(
			InvoiceDraftSchema.safeParse({ ...approved, discountType: 'PWD', discountIdNumber: 'PWD-1' }).success,
		).toBe(false);
	});

	it('counts the cash at the Z reading in centavos', () => {
		expect(countedCash({ '1000': 1, '0.25': 3, '0.05': 1 })).toBe(1000.8);
		expect(countedCash({ '0.1': 3 })).toBe(0.3);
	});

	it('refuses a payment tendered below its amount', () => {
		const payment = { method: 'CASH', amount: 380, referenceNo: 'OR-1' };
		expect(PaymentDraftSchema.safeParse({ ...payment, tenderedAmount: 500 }).success).toBe(true);
		expect(PaymentDraftSchema.safeParse({ ...payment, tenderedAmount: 100 }).success).toBe(false);
		// Cash may carry the OR number; e-wallets, cards and checks need their reference, a check its bank and date.
		expect(PaymentDraftSchema.safeParse({ ...payment, referenceNo: ' ' }).success).toBe(true);
		expect(PaymentDraftSchema.safeParse({ method: 'GCASH', amount: 10, referenceNo: ' ' }).success).toBe(false);
		expect(
			PaymentDraftSchema.safeParse({ method: 'GCASH', amount: 10, tenderedAmount: 20, referenceNo: 'G' }).success,
		).toBe(false);
		expect(PaymentDraftSchema.safeParse({ method: 'CHECK', amount: 10, referenceNo: 'C-1' }).success).toBe(false);
		expect(
			PaymentDraftSchema.safeParse({
				method: 'CHECK',
				amount: 10,
				referenceNo: 'C-1',
				bankName: 'BPI',
				checkDate: '2026-11-06',
			}).success,
		).toBe(true);
		expect(SplitPaymentSchema.safeParse([payment, payment]).success).toBe(false);
		expect(changeDue(380, 500)).toBe(120);
		expect(changeDue(380)).toBe(0);
	});

	it('moves to partially paid, then paid', () => {
		expect(paymentOutcome(380, 0)).toEqual({ balance: 380, status: 'ISSUED' });
		expect(paymentOutcome(380, 300)).toEqual({ balance: 80, status: 'PARTIALLY_PAID' });
		expect(paymentOutcome(380, 380)).toEqual({ balance: 0, status: 'PAID' });
	});

	it('splits VATable sales out of VAT-inclusive prices', () => {
		const totals = computeInvoiceTotals([
			{ quantity: 1, unitPrice: 300, taxType: 'VAT_EXEMPT' },
			{ quantity: 2, unitPrice: 56, taxType: 'VATABLE' },
		]);
		expect(totals).toMatchObject({
			grossAmount: 412,
			vatableSales: 100,
			vatAmount: 12,
			vatExemptSales: 300,
			netAmount: 412,
		});
	});
});
