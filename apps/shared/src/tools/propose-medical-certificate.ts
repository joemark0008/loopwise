import z from 'zod/v3';

import { CERTIFICATE_TYPES } from '../medical-certificate';
import { EncounterIdSchema, RULES } from './encounter-proposal';

export { type Output, OutputSchema } from './encounter-proposal';

export const description = [
	"Show the clinician a draft medical certificate for one of this patient's encounters, in a card they can edit, save",
	'or cancel. Leave the diagnosis out to use the diagnoses recorded for the visit. If the visit already has a draft',
	'certificate, the card replaces it (before → after), so use this tool to change one too. Confirm saves a draft certificate;',
	"issuing it is the clinician's own step on the encounter page.",
	RULES,
].join(' ');

/** Loose on purpose: the card validates with `MedicalCertificateDraftSchema`. */
export const InputSchema = z.object({
	encounterId: EncounterIdSchema,
	diagnosisText: z
		.string()
		.optional()
		.describe('Only if the clinician worded it; else the visit diagnoses are used.'),
	type: z.enum(CERTIFICATE_TYPES).optional().describe('Default MEDICAL_CERTIFICATE.'),
	isFitToWork: z.boolean().optional().describe('Fit (true) or unfit (false) to work or school, if they said.'),
	restDays: z.number().int().optional(),
	restFrom: z.string().optional().describe('First day of rest, YYYY-MM-DD; the visit day when left out.'),
	findings: z.string().optional(),
	recommendation: z.string().optional().describe('e.g. "Light duty for one week".'),
	purpose: z.string().optional().describe('e.g. "work", "school".'),
});

export type Input = z.infer<typeof InputSchema>;
