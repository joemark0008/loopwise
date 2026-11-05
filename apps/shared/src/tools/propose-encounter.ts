import z from 'zod/v3';

import { ENCOUNTER_NOTES_MAX_LENGTH, ENCOUNTER_REASON_MAX_LENGTH, ENCOUNTER_TYPES } from '../encounter';
import { ClinicSchema } from './propose-patient-registration';

export const description = [
	"Show the clinician a draft encounter (visit) for this chat's patient, in a card they can edit, confirm or cancel.",
	'Use it when they describe a visit or ask to record or start one. Write the reason in a few words and the notes',
	'from what they said (complaint, findings, assessment, plan); put stated vital signs in `vitals` and stated or agreed',
	'diagnoses in `diagnoses` with their ICD-10 code. Never add findings they did not state.',
	"This records nothing: only the clinician can, with the card's Confirm button. Never say the encounter is saved",
	'until they tell you so. Only available in a patient chart chat. Never call this tool together with another tool.',
].join(' ');

/** The vital signs the clinician stated; shared with `propose_vitals`. */
export const VitalsInputSchema = z
	.object({
		systolicMmHg: z.number().optional(),
		diastolicMmHg: z.number().optional(),
		heartRateBpm: z.number().optional(),
		respiratoryRate: z.number().optional(),
		temperatureC: z.number().optional(),
		spo2Pct: z.number().optional(),
		weightKg: z.number().optional(),
		heightCm: z.number().optional(),
		bloodGlucoseMgDl: z.number().optional(),
		painScore: z.number().optional(),
	})
	.optional()
	.describe(
		'Vital signs the clinician stated (mmHg, bpm, /min, °C, %, kg, cm, mg/dL). Leave out any not stated; never send 0.',
	);

/** Loose on purpose: the card validates with `EncounterDraftSchema` and the clinician fixes what the model got wrong. */
export const InputSchema = z.object({
	reason: z
		.string()
		.max(ENCOUNTER_REASON_MAX_LENGTH)
		.describe('Chief complaint: why the patient came, in a few words, e.g. "Fatigue for 2 weeks, BP check".'),
	type: z
		.enum(ENCOUNTER_TYPES)
		.optional()
		.describe('The kind of visit, only if clear (FOLLOW_UP, PRENATAL, PEME …); default CONSULTATION.'),
	notes: z
		.string()
		.max(ENCOUNTER_NOTES_MAX_LENGTH)
		.optional()
		.describe('Clinical notes as the clinician stated them; short lines, e.g. "BP 140/90. Plan: HbA1c, FBS."'),
	startedAt: z
		.string()
		.optional()
		.describe('When the visit started (ISO 8601), only if the clinician said; else now.'),
	vitals: VitalsInputSchema,
	diagnoses: z
		.array(
			z.object({
				icd10Code: z.string().describe('ICD-10 (WHO 2010), e.g. "I10".'),
				description: z.string().describe('The diagnosis, e.g. "Essential (primary) hypertension".'),
			}),
		)
		.max(10)
		.optional()
		.describe('Diagnoses the clinician stated or agreed to, first = primary; recorded as not final (working).'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	patientId: z.string(),
	/** The clinics the clinician can record at; the card preselects the first. */
	clinics: z.array(ClinicSchema),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
