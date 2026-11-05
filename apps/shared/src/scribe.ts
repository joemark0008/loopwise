/**
 * The AI scribe (PLAN.md §4.3, DESIGN.md §7.5): one Wise draft of a whole consultation, split into parts the doctor
 * confirms one by one. Shared by the API (which settles each part once) and the scribe panel.
 *
 * A part confirms through the mutation of the card it stands for (`SCRIBE_PART_TOOLS`): the SOAP note through
 * `updateEncounterNote` as a `propose_encounter_note` card would, the vitals through `recordVitals`, and so on. Each
 * part settles once, under its own key (`scribeOutcomeKey`), so confirming the prescription leaves the orders open.
 */

export const SCRIBE_TOOL_NAME = 'propose_scribe_note';

/** The parts of a scribe draft, in the order the panel shows them. A draft has one card per diagnosis. */
export const SCRIBE_PART_KINDS = [
	'soap',
	'vitals',
	'diagnosis',
	'prescription',
	'orders',
	'certificate',
	'follow_up',
	'summary',
] as const;
export type ScribePartKind = (typeof SCRIBE_PART_KINDS)[number];

/** The Wise card each part stands for: the mutation accepts the part as it accepts that card. */
export const SCRIBE_PART_TOOLS: Record<ScribePartKind, string> = {
	soap: 'propose_encounter_note',
	vitals: 'propose_vitals',
	diagnosis: 'propose_diagnosis',
	prescription: 'propose_prescription',
	orders: 'propose_order',
	certificate: 'propose_medical_certificate',
	follow_up: 'propose_encounter_note',
	summary: 'propose_encounter_note',
};

export const SCRIBE_PART_LABELS: Record<ScribePartKind, string> = {
	soap: 'SOAP note',
	vitals: 'Vital signs',
	diagnosis: 'Diagnosis',
	prescription: 'Prescription',
	orders: 'Lab and imaging',
	certificate: 'Medical certificate',
	follow_up: 'Follow-up',
	summary: 'Patient summary',
};

/** At most this many diagnoses in one draft (`diagnosis-0` … `diagnosis-7`). */
export const MAX_SCRIBE_DIAGNOSES = 8;

/** A part key: the kind, and the index for a diagnosis (`diagnosis-1`). */
export const SCRIBE_PART_PATTERN = /^(soap|vitals|diagnosis-[0-7]|prescription|orders|certificate|follow_up|summary)$/;

/** The kind of a part key, or undefined for a key that isn't one. */
export function scribePartKind(part: string): ScribePartKind | undefined {
	if (!SCRIBE_PART_PATTERN.test(part)) {
		return undefined;
	}
	return (part.startsWith('diagnosis-') ? 'diagnosis' : part) as ScribePartKind;
}

/** The card a part stands for, or undefined for a key that isn't a part. */
export function scribePartTool(part: string): string | undefined {
	const kind = scribePartKind(part);
	return kind && SCRIBE_PART_TOOLS[kind];
}

/** The key a part settles under (`wise_proposal_outcomes.tool_call_id`): one outcome per part of one tool call. */
export const scribeOutcomeKey = (toolCallId: string, part?: string | null) =>
	part ? `${toolCallId}#${part}` : toolCallId;

/** The languages of the patient summary: English, Filipino and Cebuano (Bisaya). */
export const SCRIBE_LANGUAGES = ['en', 'fil', 'ceb'] as const;
export type ScribeLanguage = (typeof SCRIBE_LANGUAGES)[number];
export const SCRIBE_LANGUAGE_LABELS: Record<ScribeLanguage, string> = {
	en: 'English',
	fil: 'Filipino',
	ceb: 'Cebuano (Bisaya)',
};

/** The longest dictation or transcript the panel sends to Wise. */
export const SCRIBE_TRANSCRIPT_MAX_LENGTH = 20_000;

/**
 * Recording consent (DESIGN.md §8.7): a visit-specific `patient_consents` row. The reference's consent types have no
 * "recording" value; PHOTO_VIDEO is the one about capturing the patient on media, so a recorded consult uses it, tied
 * to the encounter. TELEMEDICINE is about remote care, not recording, and a recorded in-clinic consult isn't one.
 */
export const RECORDING_CONSENT_TYPE = 'PHOTO_VIDEO';

/** The version of the consent text below; a new text gets a new version. */
export const RECORDING_CONSENT_VERSION = 'scribe-recording-2026-11';

/** What the doctor reads to the patient before recording. */
export const RECORDING_CONSENT_TEXT = [
	'With your permission, this consultation will be recorded so the clinic assistant can draft the doctor’s notes.',
	'The audio is turned into text and is not kept; the doctor checks every note before it is saved.',
	'You can say no, and the doctor will type the notes instead.',
].join(' ');

/** The message the scribe panel sends to Wise: the visit, the summary language and the dictation. */
export function scribeRequestMessage(input: {
	encounterId: string;
	language: ScribeLanguage;
	transcript: string;
}): string {
	return [
		`Draft this visit with the AI scribe (propose_scribe_note) for encounter ${input.encounterId}.`,
		`Write the patient summary in ${SCRIBE_LANGUAGE_LABELS[input.language]}.`,
		'Use only what was said below.',
		'',
		'<transcript>',
		input.transcript.trim(),
		'</transcript>',
	].join('\n');
}
