import z from 'zod/v3';

/**
 * The visit invoice (BIR sales invoice, the reference's `Invoice`): the one set of rules for the API, the billing tab
 * and the Wise cards. Prices are what the clinic charges, VAT included for VATABLE items (BIR: VAT-inclusive pricing).
 *
 * - Senior citizen (RA 9994) and PWD (RA 10754) discount: 20% of the price net of VAT, and the sale is VAT-exempt
 *   (the VAT is removed first, `lessVatScPwd`). It covers medical and dental services, lab fees, professional fees and
 *   medicines, so here it applies to every line of the visit bill. The beneficiary's ID number is recorded.
 * - PhilHealth package coverage (e.g. Konsulta) is not a discount: PhilHealth pays that part, so it is recorded as a
 *   PHILHEALTH payment against the issued invoice, with the package code as its reference.
 *
 * Amounts are computed in centavos (integers) and returned in pesos with 2 decimals.
 */

export const SERVICE_CATEGORIES = [
	'CONSULTATION',
	'PROFESSIONAL_FEE',
	'PROCEDURE',
	'LABORATORY',
	'IMAGING',
	'MEDICINE',
	'SUPPLY',
	'VACCINE',
	'PACKAGE',
	'CERTIFICATE',
	'OTHER',
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const TAX_TYPES = ['VATABLE', 'VAT_EXEMPT', 'ZERO_RATED'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
	VATABLE: 'VATable',
	VAT_EXEMPT: 'VAT-exempt',
	ZERO_RATED: 'Zero-rated',
};

/** The statutory discounts the desk applies: 20% + VAT exemption. */
export const STATUTORY_DISCOUNT_TYPES = ['SENIOR_CITIZEN', 'PWD'] as const;
export type StatutoryDiscountType = (typeof STATUTORY_DISCOUNT_TYPES)[number];

export const DISCOUNT_LABELS: Record<StatutoryDiscountType, string> = {
	SENIOR_CITIZEN: 'Senior citizen (20%, RA 9994)',
	PWD: 'Person with disability (20%, RA 10754)',
};

/** The patient ID that proves each discount (`PatientIdentification.type`). */
export const DISCOUNT_ID_TYPES: Record<StatutoryDiscountType, 'SENIOR_CITIZEN_OSCA' | 'PWD'> = {
	SENIOR_CITIZEN: 'SENIOR_CITIZEN_OSCA',
	PWD: 'PWD',
};

export const SC_PWD_DISCOUNT_RATE = 0.2;
export const VAT_RATE = 0.12;
export const MAX_INVOICE_LINES = 50;

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
	DRAFT: 'Draft',
	ISSUED: 'Issued',
	PARTIALLY_PAID: 'Partially paid',
	PAID: 'Paid',
	VOID: 'Void',
};

export const PAYMENT_METHODS = [
	'CASH',
	'GCASH',
	'MAYA',
	'QR_PH',
	'CREDIT_CARD',
	'DEBIT_CARD',
	'BANK_TRANSFER',
	'CHECK',
	'HMO',
	'PHILHEALTH',
	'CORPORATE_CHARGE',
	'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	CASH: 'Cash',
	GCASH: 'GCash',
	MAYA: 'Maya',
	QR_PH: 'QR Ph',
	CREDIT_CARD: 'Credit card',
	DEBIT_CARD: 'Debit card',
	BANK_TRANSFER: 'Bank transfer',
	CHECK: 'Check',
	HMO: 'HMO',
	PHILHEALTH: 'PhilHealth package',
	CORPORATE_CHARGE: 'Corporate charge',
	OTHER: 'Other',
};

/** What the reference number of a payment is, per method (the official receipt for cash). */
export function paymentReferenceLabel(method: PaymentMethod): string {
	switch (method) {
		case 'CASH':
			return 'Official receipt (OR) number';
		case 'PHILHEALTH':
			return 'Package code (e.g. KONSULTA)';
		case 'CHECK':
			return 'Check number';
		case 'CREDIT_CARD':
		case 'DEBIT_CARD':
			return 'Approval code';
		default:
			return 'Reference number';
	}
}

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;
const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
const pesos = (label: string, max: number) =>
	z.coerce
		.number({ invalid_type_error: `${label} must be a number.` })
		.min(0, `${label} cannot be negative.`)
		.max(max, `${label} must be at most ${max.toLocaleString()}.`)
		.refine(twoDecimals, `${label} has at most 2 decimals.`);

export const InvoiceLineSchema = z.object({
	/** The catalog item, when the line is one (`ServiceItem`); free description otherwise. */
	serviceItemId: z.preprocess(emptyToUndefined, z.string().uuid('Pick an item from the catalog.').optional()),
	description: z.string().trim().min(1, 'Describe the line.').max(200, 'Keep the description under 200 characters.'),
	quantity: z.coerce
		.number({ invalid_type_error: 'Quantity must be a number.' })
		.gt(0, 'Quantity must be more than 0.')
		.max(9999, 'Quantity must be at most 9,999.')
		.refine(twoDecimals, 'Quantity has at most 2 decimals.'),
	unitPrice: z.preprocess(emptyToUndefined, pesos('Price', 1_000_000)),
	taxType: z.enum(TAX_TYPES).default('VAT_EXEMPT'),
});

export type InvoiceLineDraft = z.output<typeof InvoiceLineSchema>;

export const InvoiceDraftSchema = z
	.object({
		lines: z
			.array(InvoiceLineSchema)
			.min(1, 'Add at least one line.')
			.max(MAX_INVOICE_LINES, `An invoice holds at most ${MAX_INVOICE_LINES} lines.`),
		discountType: z.preprocess(emptyToUndefined, z.enum(STATUTORY_DISCOUNT_TYPES).optional()),
		/** The senior citizen (OSCA) or PWD ID number as presented. */
		discountIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
	})
	.superRefine((draft, ctx) => {
		if (draft.discountType && !draft.discountIdNumber) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['discountIdNumber'],
				message: 'Record the senior citizen / PWD ID number shown.',
			});
		}
	});

export type InvoiceDraft = z.output<typeof InvoiceDraftSchema>;

export const PaymentDraftSchema = z
	.object({
		method: z.enum(PAYMENT_METHODS),
		amount: pesos('Amount', 10_000_000).refine((value) => value > 0, 'Amount must be more than 0.'),
		/** Cash handed over; the change is computed. */
		tenderedAmount: z.preprocess(emptyToUndefined, pesos('Amount tendered', 10_000_000).optional()),
		referenceNo: z
			.string()
			.trim()
			.min(1, 'Add the receipt or reference number.')
			.max(60, 'Keep the reference under 60 characters.'),
	})
	.superRefine((draft, ctx) => {
		if (draft.tenderedAmount !== undefined && draft.tenderedAmount < draft.amount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['tenderedAmount'],
				message: 'The amount tendered is less than the amount paid.',
			});
		}
	});

export type PaymentDraft = z.output<typeof PaymentDraftSchema>;

/** Why an invoice is voided (kept on the invoice and its payments; BIR asks for it). */
export const InvoiceVoidReasonSchema = z
	.string()
	.trim()
	.min(3, 'Say why the invoice is being voided.')
	.max(300, 'Keep the reason under 300 characters.');

export interface InvoiceLineTotals {
	/** quantity × unit price, as charged (VAT included for VATABLE lines). */
	gross: number;
	/** The VAT in the line (0 when VAT-exempt, zero-rated, or exempted for SC/PWD). */
	vatAmount: number;
	/** The SC/PWD VAT removed plus the 20% discount. */
	discountAmount: number;
	/** What the line adds to the amount due. */
	lineTotal: number;
}

export interface InvoiceTotals {
	lines: InvoiceLineTotals[];
	grossAmount: number;
	vatableSales: number;
	vatExemptSales: number;
	zeroRatedSales: number;
	vatAmount: number;
	lessVatScPwd: number;
	scPwdDiscount: number;
	otherDiscount: number;
	/** Amount due: gross − SC/PWD VAT − discounts. Never below zero. */
	netAmount: number;
}

const toCentavos = (pesosValue: number) => Math.round(pesosValue * 100);
const toPesos = (centavos: number) => centavos / 100;

/**
 * The BIR breakdown of a visit invoice. Per line, in centavos: VATABLE prices include 12% VAT
 * (net = gross × 100/112). With a senior citizen / PWD discount (RA 9994, RA 10754) every line is VAT-exempt for the
 * beneficiary: the VAT is removed (`lessVatScPwd`), then 20% of the net is taken off (`scPwdDiscount`), and the net of
 * VAT is reported as VAT-exempt sales.
 */
export function computeInvoiceTotals(
	lines: readonly { quantity: number; unitPrice: number; taxType?: TaxType | null }[],
	discountType?: StatutoryDiscountType | null,
): InvoiceTotals {
	let vatable = 0;
	let vatExempt = 0;
	let zeroRated = 0;
	let vat = 0;
	let lessVat = 0;
	let discount = 0;
	let gross = 0;
	const lineTotals = lines.map((line) => {
		const lineGross = toCentavos(line.quantity * line.unitPrice);
		const taxType = line.taxType ?? 'VAT_EXEMPT';
		const lineNet = taxType === 'VATABLE' ? Math.round((lineGross * 100) / 112) : lineGross;
		const lineVat = lineGross - lineNet;
		gross += lineGross;
		if (discountType) {
			const lineDiscount = Math.round(lineNet * SC_PWD_DISCOUNT_RATE);
			lessVat += lineVat;
			discount += lineDiscount;
			if (taxType === 'ZERO_RATED') {
				zeroRated += lineNet;
			} else {
				vatExempt += lineNet;
			}
			return {
				gross: toPesos(lineGross),
				vatAmount: 0,
				discountAmount: toPesos(lineVat + lineDiscount),
				lineTotal: toPesos(lineNet - lineDiscount),
			};
		}
		if (taxType === 'VATABLE') {
			vatable += lineNet;
			vat += lineVat;
		} else if (taxType === 'ZERO_RATED') {
			zeroRated += lineGross;
		} else {
			vatExempt += lineGross;
		}
		return {
			gross: toPesos(lineGross),
			vatAmount: toPesos(lineVat),
			discountAmount: 0,
			lineTotal: toPesos(lineGross),
		};
	});
	return {
		lines: lineTotals,
		grossAmount: toPesos(gross),
		vatableSales: toPesos(vatable),
		vatExemptSales: toPesos(vatExempt),
		zeroRatedSales: toPesos(zeroRated),
		vatAmount: toPesos(vat),
		lessVatScPwd: toPesos(lessVat),
		scPwdDiscount: toPesos(discount),
		otherDiscount: 0,
		netAmount: toPesos(Math.max(0, gross - lessVat - discount)),
	};
}

/** The balance after `paid`, and the status it puts an issued invoice in. */
export function paymentOutcome(
	netAmount: number,
	amountPaid: number,
): { balance: number; status: 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' } {
	const balance = toPesos(Math.max(0, toCentavos(netAmount) - toCentavos(amountPaid)));
	return {
		balance,
		status: balance === 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED',
	};
}

/** Change for cash tendered (0 when nothing tendered). */
export function changeDue(amount: number, tenderedAmount?: number | null): number {
	return tenderedAmount ? toPesos(Math.max(0, toCentavos(tenderedAmount) - toCentavos(amount))) : 0;
}

export const formatPesos = (value: number) =>
	`₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
