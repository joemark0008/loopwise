import z from 'zod/v3';

import { CHARGE_KINDS, DISCOUNT_KINDS } from '../encounter-bill';
import { EncounterIdSchema, RULES } from './encounter-proposal';

export { type Output, OutputSchema } from './encounter-proposal';

export const description = [
	"Show the clinician a draft bill for one of this patient's encounters, in a card they can edit, save or cancel.",
	"Leave the charges out to start from the facility's fee schedule (consultation and the tests ordered). Add the",
	'senior citizen or PWD discount only if the clinician says the patient has the card. If the visit already has a draft',
	'bill, the card replaces it (before → after), so use this tool to change one too. Confirm saves a draft bill;',
	'finalizing it is a separate step.',
	RULES,
].join(' ');

export const InputSchema = z.object({
	encounterId: EncounterIdSchema,
	charges: z
		.array(
			z.object({
				kind: z.enum(CHARGE_KINDS),
				description: z.string(),
				quantity: z.number().int().optional(),
				unitPrice: z.number().optional().describe('Pesos, only if the clinician gave a price.'),
			}),
		)
		.optional(),
	discountKind: z.enum(DISCOUNT_KINDS).optional(),
	philhealthPackageCode: z.string().optional(),
	philhealthCoverage: z.number().optional().describe('Pesos PhilHealth covers, only if stated.'),
});

export type Input = z.infer<typeof InputSchema>;
