import { describe, expect, it } from 'vitest';

import { InvoiceTotalsService, type PricedLine, type TotalsInput } from './invoice-totals.service.js';

const line = (
	unitPrice: number | string,
	taxType: PricedLine['taxType'] = 'VAT_EXEMPT',
	quantity: number | string = 1,
	scPwdEligible = true,
): PricedLine => ({ serviceItemId: null, description: 'x', quantity, unitPrice, taxType, scPwdEligible });

const VAT: TotalsInput = { vatRegistered: true };
const NON_VAT: TotalsInput = { vatRegistered: false };

/** Every amount as a fixed 2-decimal string, so a test reads like the printed invoice. */
const printed = (result: ReturnType<InvoiceTotalsService['compute']>) => ({
	invoice: Object.fromEntries(Object.entries(result.invoice).map(([key, value]) => [key, value.toFixed(2)])),
	lines: result.lines.map((amounts) =>
		Object.fromEntries(Object.entries(amounts).map(([key, value]) => [key, value.toFixed(2)])),
	),
});

describe('InvoiceTotalsService', () => {
	const totals = new InvoiceTotalsService();

	describe('VAT split', () => {
		it('bills VAT-exempt medical services at their price', () => {
			const result = printed(totals.compute([line(300), line(80)], VAT));
			expect(result.invoice).toMatchObject({
				grossAmount: '380.00',
				vatExemptSales: '380.00',
				vatableSales: '0.00',
				vatAmount: '0.00',
				scPwdDiscount: '0.00',
				netAmount: '380.00',
				balance: '380.00',
			});
			expect(result.lines).toEqual([
				{ gross: '300.00', vatAmount: '0.00', discountAmount: '0.00', lineTotal: '300.00' },
				{ gross: '80.00', vatAmount: '0.00', discountAmount: '0.00', lineTotal: '80.00' },
			]);
		});

		it('splits the 12% VAT out of VAT-inclusive prices, and keeps zero-rated sales apart', () => {
			const result = printed(totals.compute([line(112, 'VATABLE', 2), line(50, 'ZERO_RATED')], VAT));
			expect(result.invoice).toMatchObject({
				grossAmount: '274.00',
				vatableSales: '200.00',
				vatAmount: '24.00',
				zeroRatedSales: '50.00',
				vatExemptSales: '0.00',
				netAmount: '274.00',
			});
			expect(result.lines[0]).toEqual({
				gross: '224.00',
				vatAmount: '24.00',
				discountAmount: '0.00',
				lineTotal: '224.00',
			});
		});

		it('adds no VAT at a non-VAT clinic: every sale is VAT-exempt', () => {
			const result = printed(totals.compute([line(112, 'VATABLE'), line(50, 'ZERO_RATED')], NON_VAT));
			expect(result.invoice).toMatchObject({
				grossAmount: '162.00',
				vatableSales: '0.00',
				vatAmount: '0.00',
				zeroRatedSales: '0.00',
				vatExemptSales: '162.00',
				netAmount: '162.00',
			});
		});

		it('rounds half up per line, to the centavo, and the parts add up to the gross', () => {
			// 3 × 33.33 = 99.99 VAT-inclusive → 89.28 net + 10.71 VAT; 3 × 0.10 exempt.
			const result = totals.compute([line(33.33, 'VATABLE', 3), line('0.1', 'VAT_EXEMPT', 3)], VAT);
			expect(printed(result).invoice).toMatchObject({
				grossAmount: '100.29',
				vatableSales: '89.28',
				vatAmount: '10.71',
				vatExemptSales: '0.30',
			});
			const { vatableSales, vatAmount, vatExemptSales, zeroRatedSales, grossAmount } = result.invoice;
			expect(vatableSales.plus(vatAmount).plus(vatExemptSales).plus(zeroRatedSales).equals(grossAmount)).toBe(
				true,
			);
		});

		it('rounds the quantity × price product half up (0.5 centavo → up)', () => {
			// 1.5 × 0.05 = 0.075 → 0.08.
			expect(printed(totals.compute([line('0.05', 'VAT_EXEMPT', '1.5')], VAT)).invoice.grossAmount).toBe('0.08');
		});

		it('takes no float error: 0.1 + 0.2 is 0.30', () => {
			expect(printed(totals.compute([line('0.1'), line('0.2')], VAT)).invoice.netAmount).toBe('0.30');
		});

		it('bills nothing for an empty invoice', () => {
			expect(printed(totals.compute([], VAT)).invoice).toMatchObject({ grossAmount: '0.00', netAmount: '0.00' });
		});
	});

	describe('senior citizen / PWD (RA 9994, RA 10754)', () => {
		it('gives 20% off VAT-exempt eligible services', () => {
			const result = printed(
				totals.compute([line(300), line(80)], { ...VAT, statutoryDiscount: 'SENIOR_CITIZEN' }),
			);
			expect(result.invoice).toMatchObject({
				grossAmount: '380.00',
				vatExemptSales: '380.00',
				lessVatScPwd: '0.00',
				scPwdDiscount: '76.00',
				netAmount: '304.00',
			});
			expect(result.lines.map((amounts) => amounts.lineTotal)).toEqual(['240.00', '64.00']);
		});

		it('removes the VAT, then takes 20% of the net, on VATable medicine', () => {
			// ₱112 VAT-inclusive: ₱100 net, ₱12 VAT removed, ₱20 off, ₱80 due.
			const result = printed(totals.compute([line(112, 'VATABLE')], { ...VAT, statutoryDiscount: 'PWD' }));
			expect(result.invoice).toMatchObject({
				grossAmount: '112.00',
				vatableSales: '0.00',
				vatAmount: '0.00',
				vatExemptSales: '100.00',
				lessVatScPwd: '12.00',
				scPwdDiscount: '20.00',
				netAmount: '80.00',
			});
			expect(result.lines).toEqual([
				{ gross: '112.00', vatAmount: '0.00', discountAmount: '32.00', lineTotal: '80.00' },
			]);
		});

		it('leaves lines that are not eligible (a certificate, a free line) at full price with their VAT', () => {
			const result = printed(
				totals.compute([line(300), line(112, 'VATABLE', 1, false)], {
					...VAT,
					statutoryDiscount: 'SENIOR_CITIZEN',
				}),
			);
			expect(result.invoice).toMatchObject({
				grossAmount: '412.00',
				vatableSales: '100.00',
				vatAmount: '12.00',
				vatExemptSales: '300.00',
				scPwdDiscount: '60.00',
				netAmount: '352.00',
			});
		});

		it('keeps an eligible zero-rated line zero-rated', () => {
			const result = printed(totals.compute([line(50, 'ZERO_RATED')], { ...VAT, statutoryDiscount: 'PWD' }));
			expect(result.invoice).toMatchObject({
				zeroRatedSales: '50.00',
				scPwdDiscount: '10.00',
				netAmount: '40.00',
			});
		});

		it('takes 20% of the price at a non-VAT clinic (no VAT to remove)', () => {
			const result = printed(
				totals.compute([line(112, 'VATABLE')], { ...NON_VAT, statutoryDiscount: 'SENIOR_CITIZEN' }),
			);
			expect(result.invoice).toMatchObject({ lessVatScPwd: '0.00', scPwdDiscount: '22.40', netAmount: '89.60' });
		});

		it('rounds the 20% per line, half up', () => {
			// 20% of 0.25 = 0.05; 20% of 10.33 = 2.066 → 2.07.
			const result = printed(
				totals.compute([line('0.25'), line('10.33')], { ...VAT, statutoryDiscount: 'SENIOR_CITIZEN' }),
			);
			expect(result.invoice.scPwdDiscount).toBe('2.12');
		});
	});

	describe('other discounts and withholding tax', () => {
		it('takes a rate off each line, VAT computed on what is left', () => {
			// 10% off ₱112 VATable → ₱100.80: ₱90 net + ₱10.80 VAT.
			const result = printed(
				totals.compute([line(112, 'VATABLE'), line(300)], { ...VAT, otherDiscount: { rate: '0.1' } }),
			);
			expect(result.invoice).toMatchObject({
				grossAmount: '412.00',
				otherDiscount: '41.20',
				vatableSales: '90.00',
				vatAmount: '10.80',
				vatExemptSales: '270.00',
				netAmount: '370.80',
			});
		});

		it('spreads an amount over the lines by their gross, the last line taking the centavos left', () => {
			const result = printed(
				totals.compute([line(100), line(200), line(0)], { ...VAT, otherDiscount: { amount: 100 } }),
			);
			expect(result.lines.map((amounts) => amounts.discountAmount)).toEqual(['33.33', '66.67', '0.00']);
			expect(result.invoice).toMatchObject({ otherDiscount: '100.00', netAmount: '200.00' });
		});

		it('never discounts more than the invoice (a 100% charity discount bills nothing)', () => {
			expect(
				printed(totals.compute([line(300)], { ...VAT, otherDiscount: { amount: 500 } })).invoice.netAmount,
			).toBe('0.00');
			expect(printed(totals.compute([line(300)], { ...VAT, otherDiscount: { rate: 1 } })).invoice.netAmount).toBe(
				'0.00',
			);
		});

		it('withholds a rate of the sales net of VAT (BIR 2307)', () => {
			// ₱1,120 VATable: ₱1,000 net; 2% CWT = ₱20; due ₱1,100.
			const result = printed(
				totals.compute([line(1120, 'VATABLE')], { ...VAT, withholdingTaxRate: '0.02', amountPaid: 100 }),
			);
			expect(result.invoice).toMatchObject({
				withholdingTax: '20.00',
				withholdingTaxRate: '0.02',
				netAmount: '1100.00',
				amountPaid: '100.00',
				balance: '1000.00',
			});
		});

		it('opens the balance at the amount due, and never below zero', () => {
			expect(printed(totals.compute([line(300)], { ...VAT, amountPaid: 500 })).invoice.balance).toBe('0.00');
		});
	});
});
