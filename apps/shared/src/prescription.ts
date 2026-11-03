import z from 'zod/v3';

/**
 * Prescriptions (DESIGN.md §7): the one set of rules for the API, the prescription form and the Wise card.
 * Items name the generic first (Generics Act, RA 6675); the brand is optional.
 */
export const MEDICATION_ROUTES = [
	'oral',
	'sublingual',
	'topical',
	'inhalation',
	'nasal',
	'ophthalmic',
	'otic',
	'rectal',
	'vaginal',
	'intramuscular',
	'intravenous',
	'subcutaneous',
	'other',
] as const;
export type MedicationRoute = (typeof MEDICATION_ROUTES)[number];

export const FREQUENCIES = [
	'once a day',
	'twice a day',
	'three times a day',
	'four times a day',
	'at bedtime',
	'every 4 hours as needed',
	'every 6 hours as needed',
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
const int = (label: string, min: number, max: number) =>
	z.coerce
		.number({ invalid_type_error: `${label} must be a number.` })
		.int(`${label} must be a whole number.`)
		.min(min, `${label} must be at least ${min}.`)
		.max(max, `${label} must be at most ${max}.`);

export const PrescriptionItemSchema = z.object({
	genericName: requiredText(120, 'generic name').describe('Generic name, e.g. "Amlodipine".'),
	brandName: optionalText(120, 'brand').describe('Brand, only if the clinician named one.'),
	strength: optionalText(60, 'strength').describe('e.g. "5 mg".'),
	form: optionalText(60, 'form').describe('e.g. "tablet", "capsule", "syrup".'),
	dose: requiredText(60, 'dose').describe('How much per intake, e.g. "1 tablet".'),
	route: z.enum(MEDICATION_ROUTES).default('oral'),
	frequency: requiredText(80, 'frequency').describe('e.g. "once a day".'),
	durationDays: z.preprocess(emptyToUndefined, int('Duration', 1, 365).optional()).describe('Days.'),
	quantity: int('Quantity', 1, 9999).describe('How many units to dispense.'),
	quantityUnit: optionalText(40, 'unit').describe('e.g. "tablets", "bottles".'),
	refills: z.preprocess(emptyToUndefined, int('Refills', 0, 12).default(0)),
	instructions: optionalText(500, 'instructions').describe('The sig, e.g. "Take after breakfast".'),
});

export type PrescriptionItemDraft = z.output<typeof PrescriptionItemSchema>;

export const PrescriptionDraftSchema = z.object({
	items: z
		.array(PrescriptionItemSchema)
		.min(1, 'Add at least one medicine.')
		.max(MAX_PRESCRIPTION_ITEMS, `A prescription holds at most ${MAX_PRESCRIPTION_ITEMS} medicines.`),
	notes: optionalText(1000, 'notes'),
});

export type PrescriptionDraft = z.output<typeof PrescriptionDraftSchema>;

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
	substance: string;
}

/** Items whose generic or brand name matches a recorded allergy (directly or through its drug class). */
export function allergyWarnings(
	items: readonly { genericName: string; brandName?: string | null }[],
	allergies: readonly { substance: string }[],
): AllergyWarning[] {
	const warnings: AllergyWarning[] = [];
	items.forEach((item, itemIndex) => {
		const names = [item.genericName, item.brandName ?? ''].map((name) => name.toLowerCase()).filter(Boolean);
		for (const allergy of allergies) {
			const substance = allergy.substance.trim().toLowerCase();
			const covered = [substance, ...(ALLERGY_CLASSES[substance] ?? [])];
			if (names.some((name) => covered.some((drug) => name.includes(drug) || drug.includes(name)))) {
				warnings.push({ itemIndex, genericName: item.genericName, substance: allergy.substance });
			}
		}
	});
	return warnings;
}
