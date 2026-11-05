import z from 'zod/v3';

import { ENCOUNTER_NOTES_MAX_LENGTH, ENCOUNTER_REASON_MAX_LENGTH } from '../encounter';

export const description = [
	"Show the clinician a change to the SOAP note of one of this chat's patient's encounters, as a before → after card",
	'they can edit, confirm or cancel. Use it when they ask to add to, correct or update a note. Pass only the fields',
	'that change, with their full new text (keep what is still right from the current note), and leave the others out',
	'rather than sending them empty; never add findings they did',
	"not state. Leave encounterId out for the latest encounter. This saves nothing: only the clinician can, with the card's",
	'Confirm button. Never say the note is updated until they tell you so. Only available in a patient chart chat. Never',
	'call this tool together with another tool.',
].join(' ');

/** The note fields a card can change, in the order the encounter page shows them. */
export const NOTE_FIELDS = [
	'reason',
	'history',
	'physicalExam',
	'assessment',
	'plan',
	'patientInstructions',
	'followUpOn',
	'notes',
] as const;

export type NoteField = (typeof NOTE_FIELDS)[number];

export const NOTE_FIELD_LABELS: Record<NoteField, string> = {
	reason: 'Chief complaint',
	history: 'History',
	physicalExam: 'Physical exam',
	assessment: 'Assessment',
	plan: 'Plan',
	patientInstructions: 'Patient instructions',
	followUpOn: 'Follow-up on',
	notes: 'Other notes',
};

const text = (description: string) => z.string().max(ENCOUNTER_NOTES_MAX_LENGTH).optional().describe(description);

/** Loose on purpose: the card validates with `EncounterNoteSchema` and the clinician fixes what the model got wrong. */
export const InputSchema = z.object({
	encounterId: z
		.string()
		.optional()
		.describe('The encounter to change, from the patient record; leave out for the latest encounter.'),
	reason: z.string().max(ENCOUNTER_REASON_MAX_LENGTH).optional().describe('New chief complaint, in a few words.'),
	history: text('New history of present illness (subjective).'),
	physicalExam: text('New physical examination findings (objective).'),
	assessment: text('New assessment, as the clinician stated it.'),
	plan: text('New treatment plan: medicines, tests, advice.'),
	patientInstructions: text('New instructions for the patient, in plain words.'),
	followUpOn: z.string().optional().describe('New follow-up date, YYYY-MM-DD.'),
	notes: text('New other notes.'),
});

/** The note as it is now; null for an empty field. */
export const NoteSchema = z.object({
	reason: z.string().nullable(),
	history: z.string().nullable(),
	physicalExam: z.string().nullable(),
	assessment: z.string().nullable(),
	plan: z.string().nullable(),
	patientInstructions: z.string().nullable(),
	followUpOn: z.string().nullable(),
	notes: z.string().nullable(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	encounter: z.object({ id: z.string(), startedAt: z.string(), clinicName: z.string() }),
	patientName: z.string(),
	/** The note when Wise drafted the change: the "before" of the card. */
	current: NoteSchema,
	/** The encounter's version then; Confirm is refused if it changed since. */
	version: z.number().int(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Note = z.infer<typeof NoteSchema>;
