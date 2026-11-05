import z from 'zod/v3';

/**
 * Prescriptions (DESIGN.md §5): the one set of rules for the API, the prescription form and the Wise card.
 * - Generics Act (RA 6675 / RA 9502): every item names the generic; the brand is optional.
 * - Dangerous drugs (RA 9165): the prescriber needs a PDEA S2 license and each quantity is also written in words.
 */

/** Routes as the reference stores them (`prescription_items.route`), with how the Rx prints them. */
export const MEDICATION_ROUTES = [
	'PO',
	'SL',
	'TOP',
	'INH',
	'NAS',
	'OPH',
	'OTIC',
	'PR',
	'PV',
	'IM',
	'IV',
	'SC',
] as const;
export type MedicationRoute = (typeof MEDICATION_ROUTES)[number];

export const MEDICATION_ROUTE_LABELS: Record<MedicationRoute, string> = {
	PO: 'by mouth',
	SL: 'under the tongue',
	TOP: 'on the skin',
	INH: 'inhaled',
	NAS: 'in the nose',
	OPH: 'in the eye',
	OTIC: 'in the ear',
	PR: 'rectally',
	PV: 'vaginally',
	IM: 'intramuscular',
	IV: 'intravenous',
	SC: 'subcutaneous',
};

export const FREQUENCIES = [
	'once a day',
	'twice a day',
	'three times a day',
	'four times a day',
	'at bedtime',
	'every 4 hours',
	'every 6 hours',
	'every 8 hours',
	'once a week',
] as const;

export const MAX_PRESCRIPTION_ITEMS = 20;

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;
const optionalText = (max: number, label: string) =>
	z.preprocess(emptyToUndefined, z.string().trim().max(max, `Keep the ${label} under ${max} characters.`).optional());
const requiredText = (max: number, label: string) =>
	z.string().trim().min(1, `Add the ${label}.`).max(max, `Keep the ${label} under ${max} characters.`);

/** Up to 2 decimals (`prescription_items.quantity` is Decimal(10,2)): 30 tablets, 1.5 bottles. */
const quantity = z.coerce
	.number({ invalid_type_error: 'Quantity must be a number.' })
	.positive('Quantity must be more than 0.')
	.max(99_999, 'Quantity must be at most 99999.')
	.refine((value) => Math.round(value * 100) === value * 100, 'Use at most 2 decimals for the quantity.');

export const PrescriptionItemSchema = z
	.object({
		genericName: requiredText(120, 'generic name').describe('Generic name (RA 6675), e.g. "Amlodipine".'),
		brandName: optionalText(120, 'brand').describe('Brand, only if the clinician named one.'),
		strength: optionalText(60, 'strength').describe('e.g. "5 mg".'),
		dosageForm: optionalText(60, 'dosage form').describe('e.g. "tablet", "capsule", "suspension 250 mg/5 mL".'),
		dose: optionalText(60, 'dose').describe('How much per intake, e.g. "1 tablet"; used to write the sig.'),
		route: z.preprocess(emptyToUndefined, z.enum(MEDICATION_ROUTES).optional()).describe('Default PO.'),
		frequency: optionalText(80, 'frequency').describe('e.g. "three times a day".'),
		durationDays: z.preprocess(
			emptyToUndefined,
			z.coerce
				.number({ invalid_type_error: 'Duration must be a number.' })
				.int('Duration must be a whole number of days.')
				.min(1, 'Duration must be at least 1 day.')
				.max(365, 'Duration must be at most 365 days.')
				.optional(),
		),
		isPrn: z.boolean().default(false).describe('As needed (PRN).'),
		sig: optionalText(500, 'sig').describe(
			'The directions as printed, e.g. "1 capsule by mouth three times a day for 7 days". Written from the dose, route, frequency and duration when left out.',
		),
		quantity: quantity.describe('How many units to dispense.'),
		unit: optionalText(40, 'unit').describe('e.g. "capsules", "bottles".'),
		quantityInWords: optionalText(120, 'quantity in words').describe(
			'The quantity in words, e.g. "twenty (20)": required for dangerous drugs (RA 9165).',
		),
	})
	.superRefine((value, ctx) => {
		if (!value.sig && !value.dose) {
			ctx.addIssue({ code: 'custom', path: ['sig'], message: 'Add the sig, or the dose and how often.' });
		}
		if (!value.sig && value.dose && !value.frequency && !value.isPrn) {
			ctx.addIssue({ code: 'custom', path: ['frequency'], message: 'Add how often.' });
		}
	})
	.transform(({ dose, ...item }) => ({ ...item, sig: item.sig ?? composeSig({ ...item, dose }) }));

export type PrescriptionItemDraft = z.output<typeof PrescriptionItemSchema>;
export type PrescriptionItemValues = z.input<typeof PrescriptionItemSchema>;

export const PrescriptionDraftSchema = z
	.object({
		items: z
			.array(PrescriptionItemSchema)
			.min(1, 'Add at least one medicine.')
			.max(MAX_PRESCRIPTION_ITEMS, `A prescription holds at most ${MAX_PRESCRIPTION_ITEMS} medicines.`),
		notes: optionalText(1000, 'notes').describe('General advice, e.g. "Increase oral fluids".'),
		isDangerousDrug: z.boolean().default(false).describe('A dangerous drug (S2 / yellow Rx, RA 9165).'),
		s2FormSerialNo: optionalText(60, 'S2 form serial number'),
	})
	.superRefine((value, ctx) => {
		if (!value.isDangerousDrug) {
			return;
		}
		value.items.forEach((item, index) => {
			if (!item.quantityInWords) {
				ctx.addIssue({
					code: 'custom',
					path: ['items', index, 'quantityInWords'],
					message: 'Write the quantity in words too (dangerous drugs, RA 9165).',
				});
			}
		});
	});

export type PrescriptionDraft = z.output<typeof PrescriptionDraftSchema>;

/**
 * The sig as printed: "1 capsule by mouth three times a day for 7 days", "… as needed". Built from what is given.
 */
export function composeSig(item: {
	dose?: string | null;
	route?: MedicationRoute | null;
	frequency?: string | null;
	durationDays?: number | null;
	isPrn?: boolean | null;
}): string {
	return [
		item.dose,
		MEDICATION_ROUTE_LABELS[item.route ?? 'PO'],
		item.frequency,
		item.durationDays ? `for ${item.durationDays} day${item.durationDays === 1 ? '' : 's'}` : null,
		item.isPrn ? 'as needed' : null,
	]
		.filter(Boolean)
		.join(' ');
}

/** Drug classes an allergy to the class name also covers. Prototype list, not a drug-interaction database. */
const ALLERGY_CLASSES: Record<string, readonly string[]> = {
	penicillin: ['amoxicillin', 'ampicillin', 'co-amoxiclav', 'cloxacillin', 'penicillin'],
	sulfa: ['cotrimoxazole', 'sulfamethoxazole'],
	nsaid: ['ibuprofen', 'mefenamic acid', 'naproxen', 'diclofenac', 'aspirin', 'celecoxib'],
	aspirin: ['aspirin'],
	cephalosporin: ['cefalexin', 'cefuroxime', 'ceftriaxone', 'cefixime'],
};

export interface AllergyWarning {
	itemIndex: number;
	genericName: string;
	allergen: string;
}

/**
 * Items whose generic (RA 6675: prescriptions name the generic) or brand name matches a recorded allergy, directly or
 * through its drug class.
 */
export function allergyWarnings(
	items: readonly { genericName: string; brandName?: string | null }[],
	allergies: readonly { allergen: string }[],
): AllergyWarning[] {
	const warnings: AllergyWarning[] = [];
	items.forEach((item, itemIndex) => {
		const names = [item.genericName, item.brandName ?? ''].map((name) => name.trim().toLowerCase()).filter(Boolean);
		for (const allergy of allergies) {
			const allergen = allergy.allergen.trim().toLowerCase();
			if (!allergen) {
				continue;
			}
			const covered = [allergen, ...(ALLERGY_CLASSES[allergen] ?? [])];
			if (names.some((name) => covered.some((drug) => name.includes(drug) || drug.includes(name)))) {
				warnings.push({ itemIndex, genericName: item.genericName, allergen: allergy.allergen });
			}
		}
	});
	return warnings;
}
