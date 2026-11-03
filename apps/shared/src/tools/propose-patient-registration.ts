import z from 'zod/v3';

import { PATIENT_LANGUAGES, PATIENT_SEXES } from '../patient-registration';

export const description = [
	'Show the user a prefilled patient registration form, in a card where they can edit, confirm or cancel it.',
	'Use it when the user asks to register (add, create, enrol) a patient. Fill in only what the conversation says;',
	'leave unknown fields out rather than guessing. If the name, birth date or sex is missing, ask with `clarification` first;',
	'never ask about the optional fields (phone, language, MRN, PhilHealth): the clinician completes them in the card.',
	"The card checks for duplicates itself. This registers nothing: only the user can, with the card's Confirm button,",
	'after recording consent. Never say the patient is registered until the user tells you so.',
	'Never call this tool together with another tool.',
].join(' ');

/** Loose on purpose: the card validates with `PatientDraftSchema` and the user fixes what the model got wrong. */
export const InputSchema = z.object({
	givenName: z.string().describe('Given (first) name, e.g. Maria.'),
	familyName: z.string().describe('Family (last) name, e.g. Santos.'),
	birthDate: z.string().optional().describe('Birth date as YYYY-MM-DD. Convert an age only if the user asks you to.'),
	sex: z.enum(PATIENT_SEXES).optional(),
	phone: z.string().optional().describe('Mobile number, e.g. 0917 123 4567.'),
	preferredLanguage: z
		.enum(PATIENT_LANGUAGES.map((language) => language.value) as [string, ...string[]])
		.optional()
		.describe('en (English), fil (Filipino) or ceb (Cebuano).'),
	mrn: z.string().optional().describe("The facility's medical record number."),
	philHealthId: z.string().optional().describe('PhilHealth Identification Number, NN-NNNNNNNNN-N.'),
});

export const FacilitySchema = z.object({ id: z.string(), name: z.string() });

export const DuplicateSchema = z.object({
	patientId: z.string(),
	match: z.enum(['EXACT_IDENTIFIER', 'NAME_BIRTH_SEX']),
	visible: z.boolean(),
	matchedOn: z.string(),
	displayName: z.string(),
	birthYear: z.number(),
	facilityNames: z.array(z.string()),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	/** The facilities the user can register at; the card preselects the only one. */
	facilities: z.array(FacilitySchema),
	/** Possible duplicates of the draft at the first facility, when the draft was complete enough to check. */
	duplicates: z.array(DuplicateSchema),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Duplicate = z.infer<typeof DuplicateSchema>;
export type Facility = z.infer<typeof FacilitySchema>;
