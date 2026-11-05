import z from 'zod/v3';

/** Encounters (DESIGN.md §5): the one set of field rules for the API, the New encounter form and the Wise card. */
export const ENCOUNTER_REASON_MAX_LENGTH = 200;
export const ENCOUNTER_NOTES_MAX_LENGTH = 10_000;
/** Clocks drift; an encounter "now" on a slightly fast laptop is still now. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const EncounterDraftSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, 'Add the reason for the visit.')
		.max(ENCOUNTER_REASON_MAX_LENGTH, `Keep the reason under ${ENCOUNTER_REASON_MAX_LENGTH} characters.`)
		.describe('Why the patient came, in a few words, e.g. "Fatigue for 2 weeks, BP check".'),
	notes: optionalText(
		z
			.string()
			.trim()
			.max(ENCOUNTER_NOTES_MAX_LENGTH, `Keep the notes under ${ENCOUNTER_NOTES_MAX_LENGTH} characters.`),
	).describe('Clinical notes: complaint, vitals, findings, assessment and plan, as the clinician stated them.'),
	startedAt: optionalText(
		z
			.string()
			.trim()
			.refine((value) => !Number.isNaN(Date.parse(value)), 'Not a valid date and time.')
			.refine(
				(value) => Date.parse(value) <= Date.now() + FUTURE_TOLERANCE_MS,
				'The visit cannot be in the future.',
			)
			.refine((value) => Date.parse(value) >= Date.parse('1900-01-01'), 'The visit date is too far in the past.'),
	).describe('When the visit started (ISO 8601). Leave out for now.'),
});

export type EncounterDraft = z.output<typeof EncounterDraftSchema>;

/** The first message of each invalid field, keyed by field name. */
export function encounterDraftErrors(values: unknown): Partial<Record<keyof EncounterDraft, string>> {
	const parsed = EncounterDraftSchema.safeParse(values);
	if (parsed.success) {
		return {};
	}
	const errors: Partial<Record<keyof EncounterDraft, string>> = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path[0] as keyof EncounterDraft;
		errors[field] ??= issue.message;
	}
	return errors;
}
