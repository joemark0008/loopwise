import z from 'zod/v3';

import { LAB_TESTS } from './lab-tests';

/**
 * The bill of an encounter (DESIGN.md §5), prototype scale: a few charges, the 20% senior citizen / PWD discount
 * (RA 9994, RA 10754) and a PhilHealth package amount. The one set of rules for the API, the billing tab and the Wise
 * card. Out of scope: eClaims, HMOs, BIR receipts and VAT (the discount is taken on the whole subtotal).
 */
export const CHARGE_KINDS = [
	'consultation',
	'procedure',
	'laboratory',
	'imaging',
	'medicine',
	'supply',
	'other',
] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const DISCOUNT_KINDS = ['senior_citizen', 'pwd'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const DISCOUNT_LABELS: Record<DiscountKind, string> = {
	senior_citizen: 'Senior citizen (20%)',
	pwd: 'Person with disability (20%)',
};

export const DISCOUNT_RATE = 0.2;
export const MAX_CHARGES = 50;

/** A sample fee schedule in pesos, to pre-fill charges. Not a real price list. */
export const FEE_SCHEDULE: readonly { kind: ChargeKind; description: string; code?: string; unitPrice: number }[] = [
	{ kind: 'consultation', description: 'Consultation', code: 'CONSULT', unitPrice: 300 },
	{ kind: 'procedure', description: 'Wound dressing', code: 'DRESSING', unitPrice: 150 },
	{ kind: 'procedure', description: 'Nebulization', code: 'NEB', unitPrice: 200 },
	{ kind: 'laboratory', description: 'Capillary blood glucose', code: 'CBG', unitPrice: 80 },
	...LAB_TESTS.map((test) => ({
		kind: (test.kind === 'lab' ? 'laboratory' : 'imaging') as ChargeKind,
		description: test.display,
		code: test.code,
		unitPrice: test.kind === 'lab' ? 350 : 600,
	})),
];

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;
const pesos = (label: string, max: number) =>
	z.coerce
		.number({ invalid_type_error: `${label} must be a number.` })
		.min(0, `${label} cannot be negative.`)
		.max(max, `${label} must be at most ${max.toLocaleString()}.`)
		.refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, `${label} has at most 2 decimals.`);

export const ChargeSchema = z.object({
	kind: z.enum(CHARGE_KINDS),
	description: z
		.string()
		.trim()
		.min(1, 'Describe the charge.')
		.max(200, 'Keep the description under 200 characters.'),
	code: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
	quantity: z.coerce
		.number({ invalid_type_error: 'Quantity must be a number.' })
		.int('Quantity must be a whole number.')
		.min(1, 'Quantity must be at least 1.')
		.max(999, 'Quantity must be at most 999.'),
	unitPrice: pesos('Price', 1_000_000),
});

export type ChargeDraft = z.output<typeof ChargeSchema>;

export const BillDraftSchema = z.object({
	charges: z
		.array(ChargeSchema)
		.min(1, 'Add at least one charge.')
		.max(MAX_CHARGES, `A bill holds at most ${MAX_CHARGES} charges.`),
	discountKind: z.preprocess(emptyToUndefined, z.enum(DISCOUNT_KINDS).optional()),
	philhealthPackageCode: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
	philhealthCoverage: z.preprocess(emptyToUndefined, pesos('PhilHealth coverage', 1_000_000).default(0)),
});

export type BillDraft = z.output<typeof BillDraftSchema>;

const round = (value: number) => Math.round(value * 100) / 100;

export interface BillTotals {
	/** Per charge: quantity × unit price. */
	amounts: number[];
	subtotal: number;
	discountAmount: number;
	philhealthCoverage: number;
	/** What the patient pays: never below zero. */
	total: number;
}

export function computeBillTotals(
	charges: readonly { quantity: number; unitPrice: number }[],
	discountKind?: DiscountKind | null,
	philhealthCoverage = 0,
): BillTotals {
	const amounts = charges.map((charge) => round(charge.quantity * charge.unitPrice));
	const subtotal = round(amounts.reduce((sum, amount) => sum + amount, 0));
	const discountAmount = discountKind ? round(subtotal * DISCOUNT_RATE) : 0;
	const coverage = round(Math.min(philhealthCoverage, subtotal - discountAmount));
	return {
		amounts,
		subtotal,
		discountAmount,
		philhealthCoverage: coverage,
		total: round(Math.max(0, subtotal - discountAmount - coverage)),
	};
}

export const formatPesos = (value: number) =>
	`₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
