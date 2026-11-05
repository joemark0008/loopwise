import z from 'zod/v3';

/** Encounters (DESIGN.md §5): the one set of field rules for the API, the New encounter form and the Wise card. */
export const ENCOUNTER_REASON_MAX_LENGTH = 200;
export const ENCOUNTER_NOTES_MAX_LENGTH = 10_000;
/** Clocks drift; an encounter "now" on a slightly fast laptop is still now. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** The `encounter_type` enum of the schema, with how the front desk names each kind of visit. */
export const ENCOUNTER_TYPES = [
	'CONSULTATION',
	'FOLLOW_UP',
	'TELECONSULTATION',
	'PROCEDURE',
	'PEME',
	'APE',
	'KONSULTA_FPE',
	'KONSULTA_VISIT',
	'PRENATAL',
	'WELL_BABY',
	'IMMUNIZATION',
	'DENTAL',
	'EMERGENCY',
	'LAB_ONLY',
] as const;
export type EncounterType = (typeof ENCOUNTER_TYPES)[number];

export const ENCOUNTER_TYPE_LABELS: Record<EncounterType, string> = {
	CONSULTATION: 'Consultation',
	FOLLOW_UP: 'Follow-up',
	TELECONSULTATION: 'Teleconsultation',
	PROCEDURE: 'Procedure',
	PEME: 'Pre-employment exam (PEME)',
	APE: 'Annual physical exam (APE)',
	KONSULTA_FPE: 'Konsulta first patient encounter',
	KONSULTA_VISIT: 'Konsulta visit',
	PRENATAL: 'Prenatal',
	WELL_BABY: 'Well baby',
	IMMUNIZATION: 'Immunization',
	DENTAL: 'Dental',
	EMERGENCY: 'Emergency',
	LAB_ONLY: 'Lab only',
};

/**
 * The visit's status (`encounter_status`): checked in (OPEN, triage), with the doctor (IN_PROGRESS), at the cashier
 * (FOR_BILLING), done (COMPLETED), or CANCELLED (no-show, left before being seen, registered in error).
 */
export const ENCOUNTER_STATUSES = ['OPEN', 'IN_PROGRESS', 'FOR_BILLING', 'COMPLETED', 'CANCELLED'] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatus, string> = {
	OPEN: 'Waiting',
	IN_PROGRESS: 'With doctor',
	FOR_BILLING: 'For billing',
	COMPLETED: 'Completed',
	CANCELLED: 'Cancelled',
};

/**
 * The moves a visit may make. Forward only: OPEN → IN_PROGRESS → FOR_BILLING → COMPLETED, with two shortcuts
 * (IN_PROGRESS → COMPLETED for a visit with nothing to bill, e.g. a free Konsulta consult; FOR_BILLING → IN_PROGRESS
 * when the doctor reopens it before payment). A visit not yet completed may be CANCELLED. COMPLETED and CANCELLED are
 * final. The API's `transitionEncounterStatus` enforces it; the encounter page offers only these moves.
 */
export const ENCOUNTER_STATUS_TRANSITIONS: Record<EncounterStatus, readonly EncounterStatus[]> = {
	OPEN: ['IN_PROGRESS', 'CANCELLED'],
	IN_PROGRESS: ['FOR_BILLING', 'COMPLETED', 'CANCELLED'],
	FOR_BILLING: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'],
	COMPLETED: [],
	CANCELLED: [],
};

export function canTransitionEncounter(from: EncounterStatus, to: EncounterStatus): boolean {
	return ENCOUNTER_STATUS_TRANSITIONS[from].includes(to);
}

/** A visit that is still going on: its record can be added to. */
export const isEncounterActive = (status: EncounterStatus): boolean => status !== 'COMPLETED' && status !== 'CANCELLED';

const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const EncounterDraftSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, 'Add the reason for the visit.')
		.max(ENCOUNTER_REASON_MAX_LENGTH, `Keep the reason under ${ENCOUNTER_REASON_MAX_LENGTH} characters.`)
		.describe('Chief complaint: why the patient came, in a few words, e.g. "Fatigue for 2 weeks, BP check".'),
	type: z.enum(ENCOUNTER_TYPES).default('CONSULTATION').describe('The kind of visit; default CONSULTATION.'),
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
