import { describe, expect, it } from 'vitest';

import { InvoiceTotalsService, type PricedLine } from './invoice-totals.service.js';

const line = (unitPrice: number, taxType: PricedLine['taxType'] = 'VAT_EXEMPT', quantity = 1): PricedLine => ({
	serviceItemId: null,
	description: 'x',
	quantity,
	unitPrice,
	taxType,
});

describe('InvoiceTotalsService', () => {
	const totals = new InvoiceTotalsService();

	it('bills VAT-exempt medical services at their price', () => {
		const result = totals.compute([line(300), line(80)], null);
		expect(result.invoice).toMatchObject({
			grossAmount: 380,
			vatExemptSales: 380,
			vatableSales: 0,
			vatAmount: 0,
			scPwdDiscount: 0,
			netAmount: 380,
			balance: 380,
		});
		expect(result.lines).toEqual([
			{ vatAmount: 0, discountAmount: 0, lineTotal: 300 },
			{ vatAmount: 0, discountAmount: 0, lineTotal: 80 },
		]);
		expect(result.discount).toBeNull();
	});

	it('splits the 12% VAT out of VAT-inclusive prices', () => {
		const result = totals.compute([line(112, 'VATABLE', 2), line(50, 'ZERO_RATED')], null);
		expect(result.invoice).toMatchObject({
			grossAmount: 274,
			vatableSales: 200,
			vatAmount: 24,
			zeroRatedSales: 50,
			netAmount: 274,
		});
		expect(result.lines[0]).toEqual({ vatAmount: 24, discountAmount: 0, lineTotal: 224 });
	});

	it('gives a senior citizen 20% off VAT-exempt services (RA 9994)', () => {
		const result = totals.compute([line(300), line(80)], 'SENIOR_CITIZEN');
		expect(result.invoice).toMatchObject({
			grossAmount: 380,
			vatExemptSales: 380,
			lessVatScPwd: 0,
			scPwdDiscount: 76,
			netAmount: 304,
		});
		expect(result.lines).toEqual([
			{ vatAmount: 0, discountAmount: 60, lineTotal: 240 },
			{ vatAmount: 0, discountAmount: 16, lineTotal: 64 },
		]);
		expect(result.discount).toEqual({ type: 'SENIOR_CITIZEN', rate: 0.2, amount: 76, vatExempted: 0 });
	});

	it('removes the VAT, then takes 20% of the net, for a PWD buying VATable medicine (RA 10754)', () => {
		// ₱112 VAT-inclusive: ₱100 net of VAT, ₱12 VAT removed, ₱20 discount, ₱80 due.
		const result = totals.compute([line(112, 'VATABLE')], 'PWD');
		expect(result.invoice).toMatchObject({
			grossAmount: 112,
			vatableSales: 0,
			vatAmount: 0,
			vatExemptSales: 100,
			lessVatScPwd: 12,
			scPwdDiscount: 20,
			netAmount: 80,
		});
		expect(result.lines).toEqual([{ vatAmount: 0, discountAmount: 32, lineTotal: 80 }]);
		expect(result.discount).toMatchObject({ amount: 20, vatExempted: 12 });
	});

	it('rounds per line in centavos', () => {
		const result = totals.compute([line(33.33, 'VATABLE', 3), line(0.1, 'VAT_EXEMPT', 3)], null);
		// 99.99 VAT-inclusive → 89.28 net + 10.71 VAT; 0.30 exempt.
		expect(result.invoice).toMatchObject({ grossAmount: 100.29, vatableSales: 89.28, vatAmount: 10.71 });
		expect(result.invoice.vatableSales + result.invoice.vatAmount + result.invoice.vatExemptSales).toBeCloseTo(
			100.29,
			10,
		);
	});
});
