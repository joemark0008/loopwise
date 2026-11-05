import { describe, expect, it } from 'vitest';

import { changeDue, computeInvoiceTotals, InvoiceDraftSchema, PaymentDraftSchema, paymentOutcome } from './invoice';

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
	});

	it('refuses a payment tendered below its amount', () => {
		const payment = { method: 'CASH', amount: 380, referenceNo: 'OR-1' };
		expect(PaymentDraftSchema.safeParse({ ...payment, tenderedAmount: 500 }).success).toBe(true);
		expect(PaymentDraftSchema.safeParse({ ...payment, tenderedAmount: 100 }).success).toBe(false);
		expect(PaymentDraftSchema.safeParse({ ...payment, referenceNo: ' ' }).success).toBe(false);
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
