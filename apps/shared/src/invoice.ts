import z from 'zod/v3';

/**
 * The visit invoice (BIR sales invoice, the reference's `Invoice`): the one set of rules for the API, the billing tab
 * and the Wise cards. Prices are what the clinic charges, VAT included for VATABLE items (BIR: VAT-inclusive pricing).
 *
 * - VAT applies only when the organization is VAT-registered (`Organization.vatRegistration`); a non-VAT clinic
 *   reports every sale as VAT-exempt and adds no VAT.
 * - Senior citizen (RA 9994) and PWD (RA 10754) discount: on the eligible lines (medical and dental services, lab and
 *   imaging fees, professional fees, medicines, medical supplies and vaccines), 20% of the price net of VAT, and the
 *   sale is VAT-exempt (the VAT is removed first, `lessVatScPwd`). It needs the patient's OSCA / PWD ID on file.
 * - Another discount (employee, promo, special) is a rate or an amount, approved by a named person, never on top of an
 *   SC/PWD discount (the beneficiary gets the higher one; RA 9994 §4).
 * - Creditable withholding tax (a corporate buyer, BIR 2307) is a rate of the sales net of VAT.
 * - PhilHealth package coverage (e.g. Konsulta) is not a discount: PhilHealth pays that part, so it is recorded as a
 *   PHILHEALTH payment against the issued invoice, with the package code as its reference.
 *
 * The API computes the stored amounts with `InvoiceTotalsService` (Decimal); `computeInvoiceTotals` here is the same
 * arithmetic in integer centavos for the live preview, and a parity test keeps the two equal. VAT treatment, the
 * eligible categories and EWT rates are to be confirmed by the clinic's accountant (DESIGN.md §5.5).
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

/** The categories the SC/PWD discount covers (RA 9994 §4, RA 10754); certificates, packages and others are not. */
export const SC_PWD_ELIGIBLE_CATEGORIES: readonly ServiceCategory[] = [
	'CONSULTATION',
	'PROFESSIONAL_FEE',
	'PROCEDURE',
	'LABORATORY',
	'IMAGING',
	'MEDICINE',
	'SUPPLY',
	'VACCINE',
];

/** Whether a line of this category (null: a free line, not on the price list) takes the SC/PWD discount. */
export const isScPwdEligible = (category: ServiceCategory | null | undefined): boolean =>
	Boolean(category && SC_PWD_ELIGIBLE_CATEGORIES.includes(category));

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

/** Other discounts, each approved by a named person. */
export const OTHER_DISCOUNT_TYPES = ['EMPLOYEE', 'PROMO', 'SPECIAL'] as const;
export type OtherDiscountType = (typeof OTHER_DISCOUNT_TYPES)[number];

export const OTHER_DISCOUNT_LABELS: Record<OtherDiscountType, string> = {
	EMPLOYEE: 'Employee',
	PROMO: 'Promo',
	SPECIAL: "Special (doctor's discretion / charity)",
};

/** The patient ID that proves each discount (`PatientIdentification.type`). */
export const DISCOUNT_ID_TYPES: Record<StatutoryDiscountType, 'SENIOR_CITIZEN_OSCA' | 'PWD'> = {
	SENIOR_CITIZEN: 'SENIOR_CITIZEN_OSCA',
	PWD: 'PWD',
};

export const SC_PWD_DISCOUNT_RATE = 0.2;
export const VAT_RATE = 0.12;
export const MAX_INVOICE_LINES = 50;
/** Creditable withholding tax rates a corporate buyer may withhold (BIR 2307): none, 1%, 2%, 5%, 10%, 15%. */
export const WITHHOLDING_TAX_RATES = [0, 0.01, 0.02, 0.05, 0.1, 0.15] as const;
/** The default expanded withholding tax on a doctor's professional fee (to be confirmed by the accountant). */
export const DEFAULT_PF_EWT_RATE = 0.1;

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

/** The tenders the cashier desk takes (HMO, PhilHealth and corporate charges settle through their own flows). */
export const DESK_PAYMENT_METHODS = [
	'CASH',
	'GCASH',
	'MAYA',
	'QR_PH',
	'CREDIT_CARD',
	'DEBIT_CARD',
	'BANK_TRANSFER',
	'CHECK',
	'PHILHEALTH',
] as const satisfies readonly PaymentMethod[];

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

export const PAYMENT_STATUSES = ['POSTED', 'VOIDED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** What the reference number of a payment is, per method (the official receipt for cash, optional there). */
export function paymentReferenceLabel(method: PaymentMethod): string {
	switch (method) {
		case 'CASH':
			return 'Official receipt (OR) number (optional)';
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

/** Philippine peso bills and coins counted at the Z reading, in pesos. */
export const CASH_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01] as const;

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
	/** Whose fee the line is (the visit's doctor for the consultation, from "Load charges"). */
	practitionerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
	/** The pharmacy ledger rows a dispensed line bills (from "Load charges"). */
	stockMovementIds: z.preprocess((value) => value ?? [], z.array(z.string().uuid()).max(500)),
});

export type InvoiceLineDraft = z.output<typeof InvoiceLineSchema>;

export const InvoiceDraftSchema = z
	.object({
		lines: z
			.array(InvoiceLineSchema)
			.min(1, 'Add at least one line.')
			.max(MAX_INVOICE_LINES, `An invoice holds at most ${MAX_INVOICE_LINES} lines.`),
		discountType: z.preprocess(emptyToUndefined, z.enum(STATUTORY_DISCOUNT_TYPES).optional()),
		/** The patient's OSCA / PWD ID on file that was presented. */
		discountIdentificationId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
		/** Or its number as presented (matched against the IDs on file). */
		discountIdNumber: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
		otherDiscountType: z.preprocess(emptyToUndefined, z.enum(OTHER_DISCOUNT_TYPES).optional()),
		/** Percent off (10 = 10%), or … */
		otherDiscountPercent: z.preprocess(
			emptyToUndefined,
			z.coerce
				.number({ invalid_type_error: 'The percent must be a number.' })
				.gt(0, 'The percent must be more than 0.')
				.max(100, 'The percent must be at most 100.')
				.refine(twoDecimals, 'The percent has at most 2 decimals.')
				.optional(),
		),
		/** … pesos off the invoice. */
		otherDiscountAmount: z.preprocess(emptyToUndefined, pesos('The discount', 10_000_000).optional()),
		otherDiscountApprovedById: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
		withholdingTaxRate: z.preprocess(
			emptyToUndefined,
			z.coerce
				.number()
				.refine(
					(rate) => (WITHHOLDING_TAX_RATES as readonly number[]).includes(rate),
					'Pick a withholding rate.',
				)
				.optional(),
		),
	})
	.superRefine((draft, ctx) => {
		const issue = (path: string, message: string) =>
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
		if (draft.discountType && !draft.discountIdentificationId && !draft.discountIdNumber) {
			issue('discountIdNumber', "Pick the patient's senior citizen / PWD ID that was shown.");
		}
		if (!draft.otherDiscountType) {
			return;
		}
		if (draft.discountType) {
			issue('otherDiscountType', 'An SC/PWD discount is not combined with another discount (RA 9994).');
		}
		if ((draft.otherDiscountPercent === undefined) === (draft.otherDiscountAmount === undefined)) {
			issue('otherDiscountPercent', 'Give the discount as a percent or an amount.');
		}
		if (!draft.otherDiscountApprovedById) {
			issue('otherDiscountApprovedById', 'Name who approved the discount.');
		}
	});

export type InvoiceDraft = z.output<typeof InvoiceDraftSchema>;

/** The methods that need a reference number (cash may carry the OR number). */
const NEEDS_REFERENCE: readonly PaymentMethod[] = PAYMENT_METHODS.filter((method) => method !== 'CASH');

export const PaymentDraftSchema = z
	.object({
		method: z.enum(PAYMENT_METHODS),
		amount: pesos('Amount', 10_000_000).refine((value) => value > 0, 'Amount must be more than 0.'),
		/** Cash handed over; the change is computed. */
		tenderedAmount: z.preprocess(emptyToUndefined, pesos('Amount tendered', 10_000_000).optional()),
		referenceNo: z.preprocess(
			emptyToUndefined,
			z.string().trim().max(60, 'Keep the reference under 60 characters.').optional(),
		),
		bankName: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
		/** The check's date (YYYY-MM-DD). */
		checkDate: z.preprocess(
			emptyToUndefined,
			z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/, 'Give the check date.')
				.optional(),
		),
	})
	.superRefine((draft, ctx) => {
		const issue = (path: string, message: string) =>
			ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
		if (draft.tenderedAmount !== undefined) {
			if (draft.method !== 'CASH') {
				issue('tenderedAmount', 'Only cash is tendered.');
			} else if (draft.tenderedAmount < draft.amount) {
				issue('tenderedAmount', 'The amount tendered is less than the amount paid.');
			}
		}
		if (NEEDS_REFERENCE.includes(draft.method) && !draft.referenceNo) {
			issue('referenceNo', 'Add the reference number.');
		}
		if (draft.method === 'CHECK') {
			if (!draft.bankName) {
				issue('bankName', 'Name the bank.');
			}
			if (!draft.checkDate) {
				issue('checkDate', 'Give the check date.');
			}
		}
	});

export type PaymentDraft = z.output<typeof PaymentDraftSchema>;

/** Several tenders on one invoice (split tender), at most one cash. */
export const SplitPaymentSchema = z
	.array(PaymentDraftSchema)
	.min(1, 'Add a payment.')
	.max(6, 'At most 6 tenders at once.')
	.superRefine((tenders, ctx) => {
		if (tenders.filter((tender) => tender.method === 'CASH').length > 1) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Put all the cash in one tender.' });
		}
	});

/** Why an invoice or a payment is voided (kept on the record; BIR asks for it). */
export const InvoiceVoidReasonSchema = z
	.string()
	.trim()
	.min(3, 'Say why it is being voided.')
	.max(300, 'Keep the reason under 300 characters.');

export interface InvoiceLineTotals {
	/** quantity × unit price, as charged (VAT included for VATABLE lines). */
	gross: number;
	/** The VAT in the line (0 when VAT-exempt, zero-rated, exempted for SC/PWD, or the clinic is non-VAT). */
	vatAmount: number;
	/** The SC/PWD VAT removed, the SC/PWD discount and any other discount on the line. */
	discountAmount: number;
	/** What the line adds to the amount due (before withholding tax). */
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
	withholdingTax: number;
	/** Amount due: gross − SC/PWD VAT − discounts − withholding tax. Never below zero. */
	netAmount: number;
}

export interface TotalsLineInput {
	quantity: number;
	unitPrice: number;
	taxType?: TaxType | null;
	/** Takes the SC/PWD discount (`isScPwdEligible` of its category). */
	scPwdEligible?: boolean;
}

export interface TotalsOptions {
	/** The organization is VAT-registered (default true). */
	vatRegistered?: boolean;
	statutoryDiscount?: StatutoryDiscountType | null;
	/** Another discount: a rate (0.1 = 10%) or an amount in pesos. */
	otherDiscount?: { rate?: number | null; amount?: number | null } | null;
	withholdingTaxRate?: number | null;
}

const toCentavos = (pesosValue: number) => Math.round(pesosValue * 100);
const toPesos = (centavos: number) => centavos / 100;
/** a × b / c rounded half up, for non-negative integers (exact: no fraction is ever kept). */
const mulDivRound = (a: number, b: number, c: number) => Math.floor((2 * a * b + c) / (2 * c));
/** A rate as an integer of 1/10,000 (the schema keeps 4 decimals). */
const toBasisPoints = (rate: number) => Math.round(rate * 10_000);

/**
 * The BIR breakdown of an invoice, in integer centavos (the live preview; `InvoiceTotalsService` on the API is the
 * same arithmetic in Decimal). Rounding is half up to the centavo at each step, per line:
 *
 * 1. gross = quantity × unit price;
 * 2. another discount: rate × gross, or the amount spread over the lines by their gross (the last line takes the
 *    centavos left);
 * 3. VATable (at a VAT-registered clinic): net = (gross − discount) × 100/112, VAT = the rest;
 * 4. SC/PWD on an eligible line: the VAT is removed, 20% of the net is taken off, and the net is VAT-exempt sales
 *    (zero-rated stays zero-rated);
 *
 * then withholding tax = rate × (VATable + VAT-exempt + zero-rated sales), and the amount due is what is left.
 */
export function computeInvoiceTotals(lines: readonly TotalsLineInput[], options: TotalsOptions = {}): InvoiceTotals {
	const vatRegistered = options.vatRegistered ?? true;
	const statutory = options.statutoryDiscount ?? null;
	// Quantity in hundredths × price in centavos ÷ 100: integers only (0.5 × 4,357.15 is 2,178.58, not a float's 2,178.57).
	const grosses = lines.map((line) =>
		mulDivRound(Math.max(0, toCentavos(line.quantity)), Math.max(0, toCentavos(line.unitPrice)), 100),
	);
	const totalGross = grosses.reduce((sum, value) => sum + value, 0);
	const otherByLine = spreadOtherDiscount(grosses, totalGross, options.otherDiscount ?? null);

	let vatable = 0;
	let vatExempt = 0;
	let zeroRated = 0;
	let vat = 0;
	let lessVat = 0;
	let scPwd = 0;
	let other = 0;
	const lineTotals = lines.map((line, index) => {
		const gross = grosses[index];
		const lineOther = otherByLine[index];
		const charged = gross - lineOther;
		const taxType = vatRegistered ? (line.taxType ?? 'VAT_EXEMPT') : 'VAT_EXEMPT';
		const net = taxType === 'VATABLE' ? mulDivRound(charged, 100, 112) : charged;
		const lineVat = charged - net;
		other += lineOther;
		if (statutory && line.scPwdEligible) {
			const discount = mulDivRound(net, toBasisPoints(SC_PWD_DISCOUNT_RATE), 10_000);
			lessVat += lineVat;
			scPwd += discount;
			if (taxType === 'ZERO_RATED') {
				zeroRated += net;
			} else {
				vatExempt += net;
			}
			return {
				gross: toPesos(gross),
				vatAmount: 0,
				discountAmount: toPesos(lineOther + lineVat + discount),
				lineTotal: toPesos(net - discount),
			};
		}
		if (taxType === 'VATABLE') {
			vatable += net;
			vat += lineVat;
		} else if (taxType === 'ZERO_RATED') {
			zeroRated += net;
		} else {
			vatExempt += net;
		}
		return {
			gross: toPesos(gross),
			vatAmount: toPesos(lineVat),
			discountAmount: toPesos(lineOther),
			lineTotal: toPesos(charged),
		};
	});
	const sales = vatable + vatExempt + zeroRated;
	const withholding = mulDivRound(sales, toBasisPoints(options.withholdingTaxRate ?? 0), 10_000);
	return {
		lines: lineTotals,
		grossAmount: toPesos(totalGross),
		vatableSales: toPesos(vatable),
		vatExemptSales: toPesos(vatExempt),
		zeroRatedSales: toPesos(zeroRated),
		vatAmount: toPesos(vat),
		lessVatScPwd: toPesos(lessVat),
		scPwdDiscount: toPesos(scPwd),
		otherDiscount: toPesos(other),
		withholdingTax: toPesos(withholding),
		netAmount: toPesos(Math.max(0, totalGross - other - lessVat - scPwd - withholding)),
	};
}

/** Another discount per line, in centavos: a rate of each line, or an amount spread by gross (capped at the total). */
function spreadOtherDiscount(
	grosses: readonly number[],
	totalGross: number,
	discount: { rate?: number | null; amount?: number | null } | null,
): number[] {
	if (discount?.rate) {
		const basisPoints = Math.min(10_000, toBasisPoints(discount.rate));
		return grosses.map((gross) => mulDivRound(gross, basisPoints, 10_000));
	}
	if (!discount?.amount || totalGross === 0) {
		return grosses.map(() => 0);
	}
	const amount = Math.min(totalGross, toCentavos(discount.amount));
	const lastWithGross = grosses.reduce((last, gross, index) => (gross > 0 ? index : last), -1);
	let given = 0;
	return grosses.map((gross, index) => {
		if (index === lastWithGross) {
			return amount - given;
		}
		const share = Math.floor((amount * gross) / totalGross);
		given += share;
		return share;
	});
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

/** The cash counted at the Z reading: Σ denomination × count, in pesos. */
export function countedCash(denominations: Readonly<Record<string, number>>): number {
	return toPesos(
		Object.entries(denominations).reduce(
			(sum, [denomination, count]) => sum + toCentavos(Number(denomination)) * Math.max(0, Math.trunc(count)),
			0,
		),
	);
}

/** "₱1,234.50"; a negative amount (a discount, a short count) as "-₱100.00". */
export const formatPesos = (value: number) =>
	`${value < 0 ? '-' : ''}₱${Math.abs(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
