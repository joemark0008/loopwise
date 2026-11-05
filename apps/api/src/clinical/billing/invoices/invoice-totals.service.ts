import {
	computeInvoiceTotals,
	type InvoiceTotals,
	SC_PWD_DISCOUNT_RATE,
	type StatutoryDiscountType,
	type TaxType,
} from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

/** A line as the service resolved it: the catalog item (when any) has set its tax type. */
export interface PricedLine {
	serviceItemId: string | null;
	description: string;
	quantity: number;
	unitPrice: number;
	taxType: TaxType;
}

/** The amounts of an invoice and of each line, ready to store (pesos, 2 decimals). */
export interface InvoiceAmounts {
	invoice: Omit<InvoiceTotals, 'lines'> & { balance: number };
	lines: { vatAmount: number; discountAmount: number; lineTotal: number }[];
	/** The `InvoiceDiscount` row of a senior citizen / PWD discount, or null. */
	discount: { type: StatutoryDiscountType; rate: number; amount: number; vatExempted: number } | null;
}

/**
 * The arithmetic of a visit invoice, server side (the client's totals are never taken): VATable / VAT-exempt /
 * zero-rated sales, VAT, the senior citizen (RA 9994) / PWD (RA 10754) discount with its VAT exemption, the amount
 * due and the opening balance. The rules themselves are `computeInvoiceTotals` in `@loopwise/shared/invoice`, which
 * the billing tab uses to show the same numbers while typing.
 */
@Injectable()
export class InvoiceTotalsService {
	compute(lines: readonly PricedLine[], discountType: StatutoryDiscountType | null): InvoiceAmounts {
		const { lines: lineTotals, ...totals } = computeInvoiceTotals(lines, discountType);
		return {
			invoice: { ...totals, balance: totals.netAmount },
			lines: lineTotals.map(({ vatAmount, discountAmount, lineTotal }) => ({
				vatAmount,
				discountAmount,
				lineTotal,
			})),
			discount: discountType
				? {
						type: discountType,
						rate: SC_PWD_DISCOUNT_RATE,
						amount: totals.scPwdDiscount,
						vatExempted: totals.lessVatScPwd,
					}
				: null,
		};
	}
}
