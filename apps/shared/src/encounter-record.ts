import z from 'zod/v3';

import { ENCOUNTER_NOTES_MAX_LENGTH, ENCOUNTER_REASON_MAX_LENGTH } from './encounter';
import { ICD10_CODE_PATTERN, normalizeIcd10Code } from './icd10';

/**
 * The encounter's note and diagnoses (DESIGN.md §5): the one set of rules for the API, the encounter page and the
 * Wise cards. Vitals are in `./vitals`, prescriptions in `./prescription`, certificates in `./medical-certificate`.
 */
export const DIAGNOSIS_CERTAINTIES = ['provisional', 'confirmed'] as const;
export const ALLERGY_KINDS = ['drug', 'food', 'environment', 'other'] as const;
export const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'] as const;

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

const optionalText = (max: number, label: string) =>
	z.preprocess(emptyToUndefined, z.string().trim().max(max, `Keep the ${label} under ${max} characters.`).optional());

/** `YYYY-MM-DD`. */
export const DateOnlySchema = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-20.')
	.refine((value) => !Number.isNaN(Date.parse(value)), 'Not a valid date.');

export const EncounterNoteSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, 'Add the chief complaint.')
		.max(ENCOUNTER_REASON_MAX_LENGTH, `Keep the chief complaint under ${ENCOUNTER_REASON_MAX_LENGTH} characters.`)
		.describe('Chief complaint, in a few words.'),
	history: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'history').describe('History of present illness (subjective).'),
	physicalExam: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'examination').describe(
		'Physical examination findings (objective).',
	),
	assessment: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'assessment').describe("The clinician's assessment."),
	plan: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'plan').describe('Treatment plan: medicines, tests, advice.'),
	patientInstructions: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'instructions').describe(
		'What the patient should do, in plain words.',
	),
	followUpOn: z.preprocess(emptyToUndefined, DateOnlySchema.optional()).describe('Follow-up date, YYYY-MM-DD.'),
	notes: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'notes').describe('Other notes.'),
});

export type EncounterNote = z.output<typeof EncounterNoteSchema>;

export const DiagnosisDraftSchema = z.object({
	icd10Code: z
		.string()
		.transform(normalizeIcd10Code)
		.refine((code) => ICD10_CODE_PATTERN.test(code), 'Use an ICD-10 code like I10 or E11.9.')
		.describe('ICD-10 code (WHO 2010), e.g. "I10".'),
	display: z
		.string()
		.trim()
		.min(1, 'Add the diagnosis.')
		.max(300, 'Keep the diagnosis under 300 characters.')
		.describe('The diagnosis as written, normally the ICD-10 title.'),
	certainty: z.enum(DIAGNOSIS_CERTAINTIES).default('provisional'),
	isPrimary: z.boolean().default(false),
	notes: optionalText(1000, 'notes'),
});

export type DiagnosisDraft = z.output<typeof DiagnosisDraftSchema>;

export const AllergyDraftSchema = z.object({
	substance: z.string().trim().min(1, 'Add the substance.').max(120, 'Keep the substance under 120 characters.'),
	kind: z.enum(ALLERGY_KINDS).default('drug'),
	reaction: optionalText(300, 'reaction'),
	severity: z.preprocess(emptyToUndefined, z.enum(ALLERGY_SEVERITIES).optional()),
});

export type AllergyDraft = z.output<typeof AllergyDraftSchema>;

export const VoidReasonSchema = z
	.string()
	.trim()
	.min(3, 'Say why it is being voided.')
	.max(300, 'Keep the reason under 300 characters.');

/** The first message of each invalid field, keyed by field name. */
export function fieldErrors<T extends z.ZodTypeAny>(schema: T, values: unknown): Record<string, string> {
	const parsed = schema.safeParse(values);
	if (parsed.success) {
		return {};
	}
	const errors: Record<string, string> = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path.join('.') || '_';
		errors[field] ??= issue.message;
	}
	return errors;
}
