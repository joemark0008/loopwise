import { SC_PWD_DISCOUNT_RATE, type StatutoryDiscountType, type TaxType } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;
type Value = Decimal | number | string;

/** A line as the service resolved it: the catalog item (when any) has set its tax type and SC/PWD eligibility. */
export interface PricedLine {
	serviceItemId: string | null;
	description: string;
	quantity: Value;
	unitPrice: Value;
	taxType: TaxType;
	/** Takes the SC/PWD discount (`isScPwdEligible` of the item's category; free lines don't). */
	scPwdEligible: boolean;
}

export interface TotalsInput {
	/** The organization is VAT-registered (`Organization.vatRegistration = VAT`). */
	vatRegistered: boolean;
	statutoryDiscount?: StatutoryDiscountType | null;
	/** Another discount: a rate (0.1 = 10%) or an amount in pesos, never both. */
	otherDiscount?: { rate?: Value | null; amount?: Value | null } | null;
	/** Creditable withholding tax rate of a corporate buyer (BIR 2307). */
	withholdingTaxRate?: Value | null;
	/** What was paid so far (for the balance). */
	amountPaid?: Value;
}

export interface LineAmounts {
	gross: Decimal;
	vatAmount: Decimal;
	/** SC/PWD VAT removed + SC/PWD discount + other discount on the line. */
	discountAmount: Decimal;
	/** What the line adds to the amount due (before withholding tax). */
	lineTotal: Decimal;
}

export interface InvoiceTotalsResult {
	grossAmount: Decimal;
	vatableSales: Decimal;
	vatExemptSales: Decimal;
	zeroRatedSales: Decimal;
	vatAmount: Decimal;
	lessVatScPwd: Decimal;
	scPwdDiscount: Decimal;
	otherDiscount: Decimal;
	withholdingTax: Decimal;
	withholdingTaxRate: Decimal;
	netAmount: Decimal;
	amountPaid: Decimal;
	balance: Decimal;
}

/** The amounts of an invoice and of each line, ready to store (pesos, 2 decimals). */
export interface InvoiceAmounts {
	invoice: InvoiceTotalsResult;
	lines: LineAmounts[];
}

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);
const VAT_DIVISOR = new Decimal('1.12');
const SC_PWD_RATE = new Decimal(SC_PWD_DISCOUNT_RATE);

/** Half up to the centavo: the one rounding rule of every amount (BIR rounds to the centavo). */
export const centavos = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
const toDecimal = (value: Value | null | undefined) => (value == null ? ZERO : new Decimal(value));
const sum = (values: readonly Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO);

/**
 * The arithmetic of an invoice (BIR sales invoice), in Decimal and nowhere else on the server: the client's totals are
 * never taken. Pure: no I/O, no clock. Steps per line, each rounded half up to the centavo:
 *
 * 1. gross = quantity × unit price (VAT-inclusive for VATABLE items);
 * 2. another discount (employee, promo, special): rate × gross, or the amount spread over the lines by their gross
 *    with the last line taking the centavos left (capped at the total);
 * 3. VAT, only at a VAT-registered clinic (a non-VAT clinic reports every sale as VAT-exempt): VATABLE net =
 *    (gross − other discount) ÷ 1.12, VAT = the rest;
 * 4. senior citizen (RA 9994) / PWD (RA 10754) on an eligible line: the VAT is removed (`lessVatScPwd`), 20% of the net
 *    is taken off (`scPwdDiscount`), and the net counts as VAT-exempt sales (zero-rated stays zero-rated).
 *
 * Then withholding tax = rate × (VATable + VAT-exempt + zero-rated sales), the amount due (`netAmount`) = gross − other
 * discount − SC/PWD VAT − SC/PWD discount − withholding tax, never below zero, and the balance = amount due − paid.
 * `computeInvoiceTotals` in `@loopwise/shared/invoice` is the same arithmetic in centavos for the live preview
 * (`invoice-totals.parity.spec.ts`). The treatment is to be confirmed by the clinic's accountant (DESIGN.md §5.5).
 */
@Injectable()
export class InvoiceTotalsService {
	compute(lines: readonly PricedLine[], input: TotalsInput): InvoiceAmounts {
		const statutory = input.statutoryDiscount ?? null;
		const grosses = lines.map((line) =>
			Decimal.max(ZERO, centavos(toDecimal(line.quantity).times(line.unitPrice))),
		);
		const totalGross = sum(grosses);
		const others = spreadOtherDiscount(grosses, totalGross, input.otherDiscount ?? null);

		const buckets = { vatable: ZERO, vatExempt: ZERO, zeroRated: ZERO, vat: ZERO, lessVat: ZERO, scPwd: ZERO };
		const lineAmounts = lines.map((line, index): LineAmounts => {
			const gross = grosses[index];
			const other = others[index];
			const charged = gross.minus(other);
			const taxType: TaxType = input.vatRegistered ? line.taxType : 'VAT_EXEMPT';
			const net = taxType === 'VATABLE' ? centavos(charged.dividedBy(VAT_DIVISOR)) : charged;
			const vat = charged.minus(net);
			if (statutory && line.scPwdEligible) {
				const discount = centavos(net.times(SC_PWD_RATE));
				buckets.lessVat = buckets.lessVat.plus(vat);
				buckets.scPwd = buckets.scPwd.plus(discount);
				if (taxType === 'ZERO_RATED') {
					buckets.zeroRated = buckets.zeroRated.plus(net);
				} else {
					buckets.vatExempt = buckets.vatExempt.plus(net);
				}
				return {
					gross,
					vatAmount: ZERO,
					discountAmount: other.plus(vat).plus(discount),
					lineTotal: net.minus(discount),
				};
			}
			if (taxType === 'VATABLE') {
				buckets.vatable = buckets.vatable.plus(net);
				buckets.vat = buckets.vat.plus(vat);
			} else if (taxType === 'ZERO_RATED') {
				buckets.zeroRated = buckets.zeroRated.plus(net);
			} else {
				buckets.vatExempt = buckets.vatExempt.plus(net);
			}
			return { gross, vatAmount: vat, discountAmount: other, lineTotal: charged };
		});

		const otherDiscount = sum(others);
		const sales = buckets.vatable.plus(buckets.vatExempt).plus(buckets.zeroRated);
		const withholdingTaxRate = toDecimal(input.withholdingTaxRate);
		const withholdingTax = centavos(sales.times(withholdingTaxRate));
		const netAmount = Decimal.max(
			ZERO,
			totalGross.minus(otherDiscount).minus(buckets.lessVat).minus(buckets.scPwd).minus(withholdingTax),
		);
		const amountPaid = toDecimal(input.amountPaid);
		return {
			invoice: {
				grossAmount: totalGross,
				vatableSales: buckets.vatable,
				vatExemptSales: buckets.vatExempt,
				zeroRatedSales: buckets.zeroRated,
				vatAmount: buckets.vat,
				lessVatScPwd: buckets.lessVat,
				scPwdDiscount: buckets.scPwd,
				otherDiscount,
				withholdingTax,
				withholdingTaxRate,
				netAmount,
				amountPaid,
				balance: Decimal.max(ZERO, netAmount.minus(amountPaid)),
			},
			lines: lineAmounts,
		};
	}
}

/** The other discount per line: a rate of each line's gross, or the amount spread over the lines by their gross. */
function spreadOtherDiscount(
	grosses: readonly Decimal[],
	totalGross: Decimal,
	discount: { rate?: Value | null; amount?: Value | null } | null,
): Decimal[] {
	const rate = toDecimal(discount?.rate);
	if (rate.greaterThan(0)) {
		const capped = Decimal.min(rate, 1);
		return grosses.map((gross) => centavos(gross.times(capped)));
	}
	const requested = toDecimal(discount?.amount);
	if (requested.lessThanOrEqualTo(0) || totalGross.isZero()) {
		return grosses.map(() => ZERO);
	}
	const amount = Decimal.min(totalGross, centavos(requested));
	const last = grosses.reduce((found, gross, index) => (gross.greaterThan(0) ? index : found), -1);
	let given = ZERO;
	return grosses.map((gross, index) => {
		if (index === last) {
			return amount.minus(given);
		}
		// Floor, so the shares never exceed the amount; the last line takes the rest.
		const share = amount.times(gross).dividedBy(totalGross).times(HUNDRED).floor().dividedBy(HUNDRED);
		given = given.plus(share);
		return share;
	});
}
