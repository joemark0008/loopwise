import z from 'zod/v3';

import { ENCOUNTER_NOTES_MAX_LENGTH, ENCOUNTER_REASON_MAX_LENGTH } from './encounter';
import { ICD10_CODE_PATTERN, normalizeIcd10Code } from './icd10';

/**
 * The encounter's note and diagnoses (DESIGN.md §5): the one set of rules for the API, the encounter page and the
 * Wise cards. Vitals are in `./vitals`, prescriptions in `./prescription`, certificates in `./medical-certificate`.
 */
/**
 * `diagnosis_type`: the main reason for the visit (PRIMARY, one per encounter), others found (SECONDARY), an
 * impression or rule-out still being worked up (WORKING), and a chronic condition that bears on care (COMORBIDITY).
 */
export const DIAGNOSIS_TYPES = ['PRIMARY', 'SECONDARY', 'WORKING', 'COMORBIDITY'] as const;
export type DiagnosisType = (typeof DIAGNOSIS_TYPES)[number];
export const DIAGNOSIS_TYPE_LABELS: Record<DiagnosisType, string> = {
	PRIMARY: 'Primary',
	SECONDARY: 'Secondary',
	WORKING: 'Working (impression)',
	COMORBIDITY: 'Comorbidity',
};

export const ALLERGY_TYPES = ['DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER'] as const;
export type AllergyType = (typeof ALLERGY_TYPES)[number];
export const ALLERGY_SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

/** `disposition`: how the visit ended. */
export const DISPOSITIONS = [
	'SENT_HOME',
	'FOR_FOLLOW_UP',
	'REFERRED',
	'ADMITTED',
	'TRANSFERRED_ER',
	'EXPIRED',
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];
export const DISPOSITION_LABELS: Record<Disposition, string> = {
	SENT_HOME: 'Sent home',
	FOR_FOLLOW_UP: 'For follow-up',
	REFERRED: 'Referred',
	ADMITTED: 'Admitted',
	TRANSFERRED_ER: 'Transferred to ER',
	EXPIRED: 'Expired',
};

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
	reviewOfSystems: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'review of systems').describe(
		'Review of systems: pertinent positives and negatives by system.',
	),
	subjective: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'subjective').describe(
		'Other subjective findings: past, family and social history, medicines taken, adherence.',
	),
	physicalExam: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'examination').describe(
		'Physical examination findings (objective).',
	),
	objective: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'objective').describe(
		'Other objective data: point-of-care tests and results reviewed during the visit.',
	),
	assessment: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'assessment').describe("The clinician's assessment."),
	plan: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'plan').describe('Treatment plan: medicines, tests, advice.'),
	patientInstructions: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'instructions').describe(
		'What the patient should do, in plain words.',
	),
	followUpOn: z.preprocess(emptyToUndefined, DateOnlySchema.optional()).describe('Follow-up date, YYYY-MM-DD.'),
	disposition: z.preprocess(emptyToUndefined, z.enum(DISPOSITIONS).optional()).describe('How the visit ended.'),
	notes: optionalText(ENCOUNTER_NOTES_MAX_LENGTH, 'notes').describe('Other notes.'),
});

export type EncounterNote = z.output<typeof EncounterNoteSchema>;

export const DiagnosisDraftSchema = z.object({
	icd10Code: z
		.string()
		.transform(normalizeIcd10Code)
		.refine((code) => ICD10_CODE_PATTERN.test(code), 'Use an ICD-10 code like I10 or E11.9.')
		.describe('ICD-10 code (WHO 2010), e.g. "I10".'),
	description: z
		.string()
		.trim()
		.min(1, 'Add the diagnosis.')
		.max(300, 'Keep the diagnosis under 300 characters.')
		.describe('The diagnosis as written on the Rx and certificate, normally the ICD-10 title.'),
	type: z.enum(DIAGNOSIS_TYPES).optional().describe('Default: PRIMARY for the first diagnosis, else SECONDARY.'),
	isFinal: z.boolean().default(true).describe('False for a provisional diagnosis still being worked up.'),
	notes: optionalText(1000, 'notes'),
});

export type DiagnosisDraft = z.output<typeof DiagnosisDraftSchema>;

export const AllergyDraftSchema = z.object({
	allergen: z.string().trim().min(1, 'Add the allergen.').max(120, 'Keep the allergen under 120 characters.'),
	type: z.enum(ALLERGY_TYPES).default('DRUG'),
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
