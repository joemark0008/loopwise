import z from 'zod/v3';

import { ENCOUNTER_NOTES_MAX_LENGTH, ENCOUNTER_REASON_MAX_LENGTH } from '../encounter';
import { DISPOSITIONS } from '../encounter-record';
import { CERTIFICATE_TYPES } from '../medical-certificate';
import { MAX_PRESCRIPTION_ITEMS } from '../prescription';
import { MAX_SCRIBE_DIAGNOSES, SCRIBE_LANGUAGES } from '../scribe';
import { EncounterIdSchema } from './encounter-proposal';
import { VitalsInputSchema } from './propose-encounter';
import { ItemSchema } from './propose-prescription';

/**
 * `propose_scribe_note` (DESIGN.md §7.5): the AI scribe's one pass over a consultation. Wise turns the doctor's
 * dictation or the consult's transcript into one draft with a part per record (SOAP note, vitals, diagnoses,
 * prescription, orders, medical certificate, follow-up, patient summary). The tool writes nothing: the API checks the
 * visit and resolves the codes, and the scribe panel shows each part as its own card, which the doctor confirms,
 * edits or dismisses through the part's own mutation.
 */
export const description = [
	'The AI scribe: turn a consultation transcript or dictation into ONE draft of the whole visit, for one encounter of',
	"this chat's patient. Use it when the user asks to draft or scribe a visit from a transcript or dictation, and put",
	'every part that was said in this one call: the SOAP note (`soap`, in English even when they spoke Taglish,',
	'Filipino or Cebuano), the vital signs said aloud, the diagnoses with ICD-10 codes (type PRIMARY for the main one,',
	'SECONDARY, or WORKING for an impression), the prescription (generic name first, RA 6675; for a dangerous drug,',
	'RA 9165, set isDangerousDrug and write each quantity in words), the lab and imaging tests to order, a medical',
	'certificate if one was asked for (type, rest days), the follow-up date or interval and the disposition, and a',
	'short plain-language summary for the patient in the language asked for (default English). Leave out any part',
	'nobody mentioned; never invent findings, doses, codes or tests, and never fill a part with a guess. This saves',
	"nothing: the doctor confirms each part with that card's own button, and the summary is a draft for the doctor that",
	'is never sent to the patient. Never write a summary that breaks bad news or a critical value to the patient: leave',
	'that to the doctor. Only available in a patient chart chat. Never call this tool together with another tool.',
].join(' ');

const text = (max: number, description: string) => z.string().max(max).optional().describe(description);

export const SoapSchema = z
	.object({
		chiefComplaint: text(ENCOUNTER_REASON_MAX_LENGTH, 'Why the patient came, in a few words.'),
		history: text(ENCOUNTER_NOTES_MAX_LENGTH, 'History of present illness.'),
		reviewOfSystems: text(ENCOUNTER_NOTES_MAX_LENGTH, 'Review of systems: pertinent positives and negatives.'),
		subjective: text(
			ENCOUNTER_NOTES_MAX_LENGTH,
			'Other subjective: past, family and social history, medicines taken, adherence.',
		),
		physicalExam: text(ENCOUNTER_NOTES_MAX_LENGTH, 'Physical examination findings.'),
		objective: text(ENCOUNTER_NOTES_MAX_LENGTH, 'Other objective: point-of-care tests, results reviewed.'),
		assessment: text(ENCOUNTER_NOTES_MAX_LENGTH, 'The assessment, as the doctor stated it.'),
		plan: text(ENCOUNTER_NOTES_MAX_LENGTH, 'The plan: medicines, tests, advice, follow-up.'),
	})
	.describe('The SOAP note in English clinical language; only the sections that were said.');

/** The diagnosis types the scribe drafts; COMORBIDITY stays the doctor's own call on the encounter page. */
export const SCRIBE_DIAGNOSIS_TYPES = ['PRIMARY', 'SECONDARY', 'WORKING'] as const;

export const DiagnosisSchema = z.object({
	icd10Code: z.string().max(10).describe('ICD-10 (WHO 2010), e.g. "I10", "E11.9".'),
	description: z.string().max(300).describe('The diagnosis, normally the ICD-10 title.'),
	type: z
		.enum(SCRIBE_DIAGNOSIS_TYPES)
		.optional()
		.describe('PRIMARY (one per visit), SECONDARY, or WORKING (an impression still being worked up).'),
});

export const PrescriptionSchema = z.object({
	items: z.array(ItemSchema).min(1).max(MAX_PRESCRIPTION_ITEMS),
	notes: z.string().max(1000).optional().describe('General advice printed on the prescription.'),
	isDangerousDrug: z.boolean().optional().describe('A dangerous drug needing the S2 / yellow Rx (RA 9165).'),
});

export const OrdersSchema = z.object({
	tests: z.array(z.string().max(120)).min(1).max(10).describe('Test names as said, e.g. "HbA1c", "lipid profile".'),
	priority: z.enum(['routine', 'urgent', 'stat']).optional().describe('Default routine.'),
	clinicalInfo: z.string().max(500).optional().describe('The indication printed on the request, if said.'),
});

export const CertificateSchema = z.object({
	type: z.enum(CERTIFICATE_TYPES).optional().describe('Default MEDICAL_CERTIFICATE.'),
	diagnosisText: z.string().max(500).optional().describe("Only if worded; else the visit's diagnoses are used."),
	isFitToWork: z.boolean().optional(),
	restDays: z.number().int().optional(),
	restFrom: z.string().optional().describe('First day of rest, YYYY-MM-DD; the visit day when left out.'),
	recommendation: z.string().max(500).optional(),
	purpose: z.string().max(200).optional().describe('e.g. "work", "school".'),
});

export const FollowUpSchema = z.object({
	date: z.string().optional().describe('Follow-up date, YYYY-MM-DD, if a date was said.'),
	inDays: z.number().int().min(1).max(365).optional().describe('Or the interval said, in days ("in 2 weeks" = 14).'),
	disposition: z.enum(DISPOSITIONS).optional().describe('How the visit ends, if said; usually FOR_FOLLOW_UP.'),
});

export const SummarySchema = z.object({
	language: z.enum(SCRIBE_LANGUAGES).describe('en English, fil Filipino, ceb Cebuano (Bisaya).'),
	text: z
		.string()
		.max(4000)
		.describe(
			'What was found and what to do next, in plain words a patient understands (no codes, no jargon), with the' +
				' medicines and the follow-up date. A draft for the doctor: never sent by itself.',
		),
});

/** Loose on purpose: each card validates with its form's schema, and the doctor fixes what the model got wrong. */
export const InputSchema = z.object({
	encounterId: EncounterIdSchema,
	soap: SoapSchema.optional(),
	vitals: VitalsInputSchema,
	diagnoses: z.array(DiagnosisSchema).max(MAX_SCRIBE_DIAGNOSES).optional(),
	prescription: PrescriptionSchema.optional(),
	orders: OrdersSchema.optional(),
	medicalCertificate: CertificateSchema.optional(),
	followUp: FollowUpSchema.optional(),
	patientSummary: SummarySchema.optional(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	patientId: z.string(),
	encounter: z.object({
		id: z.string(),
		encounterNo: z.string(),
		startedAt: z.string(),
		clinicName: z.string(),
	}),
	/** The parts of the draft, by key (`soap`, `diagnosis-0` …), in the panel's order. */
	parts: z.array(z.string()),
	/** Each drafted diagnosis, its code checked against `icd10_codes`. */
	diagnoses: z.array(
		z.object({
			icd10Code: z.string(),
			/** False when the code isn't in `icd10_codes`: the card asks for one before it can be confirmed. */
			known: z.boolean(),
			/** The ICD-10 title of a known code. */
			title: z.string().nullable(),
		}),
	),
	/** The tests named, matched against the organization's catalog; `unmatched` can't be ordered. */
	tests: z.object({
		matched: z.array(z.object({ testId: z.string(), code: z.string(), name: z.string(), category: z.string() })),
		unmatched: z.array(z.string()),
	}),
	/** The patient's recorded allergies, and the drafted medicines that match one. */
	allergies: z.array(z.object({ allergen: z.string(), severity: z.string().nullable() })),
	allergyWarnings: z.array(z.object({ genericName: z.string(), allergen: z.string() })),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

const said = (value: unknown) =>
	value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '');

/** The part keys of a draft (`SCRIBE_PART_PATTERN`), in the panel's order: only the parts that hold something. */
export function draftParts(input: Input): string[] {
	const parts: string[] = [];
	if (input.soap && Object.values(input.soap).some(said)) {
		parts.push('soap');
	}
	if (input.vitals && Object.values(input.vitals).some((value) => said(value) && value !== 0)) {
		parts.push('vitals');
	}
	(input.diagnoses ?? []).slice(0, MAX_SCRIBE_DIAGNOSES).forEach((_, index) => parts.push(`diagnosis-${index}`));
	if (input.prescription?.items.length) {
		parts.push('prescription');
	}
	if (input.orders?.tests.length) {
		parts.push('orders');
	}
	if (input.medicalCertificate) {
		parts.push('certificate');
	}
	if (input.followUp && Object.values(input.followUp).some(said)) {
		parts.push('follow_up');
	}
	if (said(input.patientSummary?.text)) {
		parts.push('summary');
	}
	return parts;
}
