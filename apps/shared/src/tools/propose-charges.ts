import z from 'zod/v3';

import { STATUTORY_DISCOUNT_TYPES } from '../invoice';
import { EncounterIdSchema, RULES } from './encounter-proposal';

export { type Output, OutputSchema } from './encounter-proposal';

export const description = [
	"Show the clinician a draft invoice for one of this patient's encounters, in a card they can edit, save or cancel.",
	"Leave the lines out to start from the clinic's price list (consultation and the tests ordered). Name lines by",
	"the clinic's item (e.g. Consultation, Fasting glucose) so its price applies. Add the senior citizen or PWD",
	'discount only if the clinician says the patient showed the card, with its ID number if said. If the visit already',
	'has a draft invoice, the card replaces it (before → after), so use this tool to change one too. Confirm saves a',
	'draft; issuing it is a separate step (propose_bill_step). PhilHealth package coverage is recorded as a PhilHealth',
	'payment after issue, not here.',
	RULES,
].join(' ');

export const InputSchema = z.object({
	encounterId: EncounterIdSchema,
	lines: z
		.array(
			z.object({
				description: z.string().describe("The item, as the clinic's price list names it when it is one."),
				quantity: z.number().optional(),
				unitPrice: z.number().optional().describe('Pesos, only if the clinician gave a price.'),
			}),
		)
		.optional(),
	discountType: z.enum(STATUTORY_DISCOUNT_TYPES).optional(),
	discountIdNumber: z.string().max(60).optional().describe('The OSCA or PWD ID number, only if stated.'),
});

export type Input = z.infer<typeof InputSchema>;
