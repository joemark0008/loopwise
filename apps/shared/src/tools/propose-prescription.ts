import z from 'zod/v3';

import { MAX_PRESCRIPTION_ITEMS, MEDICATION_ROUTES } from '../prescription';
import { EncounterIdSchema, RULES } from './encounter-proposal';

export { type Output, OutputSchema } from './encounter-proposal';

export const description = [
	"Show the clinician a draft prescription for one of this patient's encounters, in a card they can edit, save or",
	'cancel. Write the generic name first (Generics Act); add a brand only if they named one. The card warns about the',
	"patient's recorded allergies. If the visit already has a draft prescription, the card replaces it (it shows the",
	'change before → after), so use this tool to change a draft too, with the full new list of medicines. Confirm saves',
	"a draft prescription; issuing it is the clinician's own step on the encounter page.",
	RULES,
].join(' ');

/** Loose on purpose: the card validates with `PrescriptionDraftSchema` and the clinician fixes what the model got wrong. */
export const ItemSchema = z.object({
	genericName: z.string().describe('Generic name, e.g. "Amlodipine".'),
	brandName: z.string().optional().describe('Brand, only if the clinician named one.'),
	strength: z.string().optional().describe('e.g. "5 mg".'),
	form: z.string().optional().describe('e.g. "tablet".'),
	dose: z.string().describe('Per intake, e.g. "1 tablet".'),
	route: z.enum(MEDICATION_ROUTES).optional(),
	frequency: z.string().describe('e.g. "once a day".'),
	durationDays: z.number().int().optional(),
	quantity: z.number().int().optional().describe('Units to dispense; work it out from dose × frequency × days.'),
	quantityUnit: z.string().optional().describe('e.g. "tablets".'),
	instructions: z.string().optional().describe('The sig for the patient, e.g. "Take after breakfast".'),
});

export const InputSchema = z.object({
	encounterId: EncounterIdSchema,
	items: z.array(ItemSchema).min(1).max(MAX_PRESCRIPTION_ITEMS),
	notes: z.string().optional(),
});

export type Input = z.infer<typeof InputSchema>;
