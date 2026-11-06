import { computeInvoiceTotals, STATUTORY_DISCOUNT_TYPES, TAX_TYPES } from '@loopwise/shared/invoice';
import { describe, expect, it } from 'vitest';

import { InvoiceTotalsService, type PricedLine, type TotalsInput } from './invoice-totals.service.js';

/** A small deterministic generator, so a failure names a case that reproduces. */
function random(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
		return state / 2_147_483_648;
	};
}

/**
 * The billing tab previews totals with `computeInvoiceTotals` (integer centavos) while the API stores what
 * `InvoiceTotalsService` (Decimal) computes: the two must agree to the centavo on every invoice.
 */
describe('invoice totals parity (preview = stored)', () => {
	const service = new InvoiceTotalsService();

	it('agrees on 500 generated invoices', () => {
		const next = random(20_261_106);
		const pick = <T>(values: readonly T[]) => values[Math.floor(next() * values.length)];
		for (let run = 0; run < 500; run++) {
			const lines: PricedLine[] = Array.from({ length: 1 + Math.floor(next() * 5) }, () => ({
				serviceItemId: null,
				description: 'x',
				quantity: pick([1, 2, 3, 0.5, 1.25, 10]),
				unitPrice: Math.round(next() * 500_000) / 100,
				taxType: pick(TAX_TYPES),
				scPwdEligible: next() > 0.3,
			}));
			const mode = pick(['none', 'statutory', 'rate', 'amount'] as const);
			const input: TotalsInput = {
				vatRegistered: next() > 0.3,
				statutoryDiscount: mode === 'statutory' ? pick(STATUTORY_DISCOUNT_TYPES) : null,
				otherDiscount:
					mode === 'rate'
						? { rate: pick([0.05, 0.1, 0.125, 0.5, 1]) }
						: mode === 'amount'
							? { amount: Math.round(next() * 100_000) / 100 }
							: null,
				withholdingTaxRate: pick([0, 0, 0.01, 0.02, 0.05]),
			};
			const stored = service.compute(lines, input);
			const preview = computeInvoiceTotals(
				lines.map((line) => ({
					quantity: Number(line.quantity),
					unitPrice: Number(line.unitPrice),
					taxType: line.taxType,
					scPwdEligible: line.scPwdEligible,
				})),
				{
					vatRegistered: input.vatRegistered,
					statutoryDiscount: input.statutoryDiscount,
					otherDiscount: input.otherDiscount as { rate?: number; amount?: number } | null,
					withholdingTaxRate: input.withholdingTaxRate as number,
				},
			);
			const label = JSON.stringify({ run, lines, input });
			for (const key of [
				'grossAmount',
				'vatableSales',
				'vatExemptSales',
				'zeroRatedSales',
				'vatAmount',
				'lessVatScPwd',
				'scPwdDiscount',
				'otherDiscount',
				'withholdingTax',
				'netAmount',
			] as const) {
				expect(stored.invoice[key].toNumber(), `${key} of ${label}`).toBe(preview[key]);
			}
			stored.lines.forEach((amounts, index) => {
				expect(amounts.lineTotal.toNumber(), `line ${index} of ${label}`).toBe(preview.lines[index].lineTotal);
				expect(amounts.vatAmount.toNumber(), `line ${index} VAT of ${label}`).toBe(
					preview.lines[index].vatAmount,
				);
			});
		}
	});
});
