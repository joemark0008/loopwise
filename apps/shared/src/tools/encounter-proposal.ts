import z from 'zod/v3';

/**
 * What the encounter-record proposal tools share (`propose_encounter_note`, `propose_prescription`,
 * `propose_medical_certificate`, `propose_charges`). They write nothing: the card loads the encounter as the
 * clinician (row-level security), shows the draft, and only its Confirm button saves; documents are saved as drafts,
 * never issued.
 */
export const EncounterIdSchema = z
	.string()
	.describe("The encounter's id, from the patient record (the `[encounter …]` of the latest encounters).");

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	patientId: z.string(),
	encounterId: z.string(),
});

export type Output = z.infer<typeof OutputSchema>;

/** Shown in every description: the rules that keep the clinician in charge. */
export const RULES = [
	"This saves nothing: only the clinician can, with the card's Confirm button. Never say it is saved until they tell",
	'you so. Only use what the clinician said; never invent findings, doses or prices. Only available in a patient chart',
	'chat. Never call this tool together with another tool.',
].join(' ');
