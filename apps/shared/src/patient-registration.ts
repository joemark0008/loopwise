import z from 'zod/v3';

/**
 * Patient registration (DESIGN.md §5): the one set of field rules for the API, the register form and the Wise
 * proposal card, so they never disagree on what a valid patient is.
 */
export const PATIENT_NAME_MAX_LENGTH = 100;
export const PATIENT_NO_MAX_LENGTH = 40;
export const EARLIEST_BIRTH_DATE = '1900-01-01';

/** The `sex` enum of the schema (PhilHealth PMRF: male or female). */
export const PATIENT_SEXES = ['FEMALE', 'MALE'] as const;
export type PatientSex = (typeof PATIENT_SEXES)[number];

export const PATIENT_LANGUAGES = [
	{ value: 'en', label: 'English' },
	{ value: 'fil', label: 'Filipino' },
	{ value: 'ceb', label: 'Cebuano (Bisaya)' },
] as const;
export type PatientLanguage = (typeof PATIENT_LANGUAGES)[number]['value'];

/** The `identification_type` values the registration form asks for (the full list is in the schema). */
export const PATIENT_IDENTIFICATION_TYPES = {
	philHealth: 'PHILHEALTH_ID',
	seniorCitizen: 'SENIOR_CITIZEN_OSCA',
	pwd: 'PWD',
	philSys: 'PHILSYS_NATIONAL_ID',
} as const;

/** How an identification is named on screen. */
export const IDENTIFICATION_LABELS: Record<string, string> = {
	PHILHEALTH_ID: 'PhilHealth',
	PHILSYS_NATIONAL_ID: 'PhilSys',
	SENIOR_CITIZEN_OSCA: 'Senior citizen (OSCA)',
	PWD: 'PWD',
	SOLO_PARENT: 'Solo parent',
	SSS: 'SSS',
	GSIS: 'GSIS',
	UMID: 'UMID',
	TIN: 'TIN',
	DRIVERS_LICENSE: "Driver's license",
	PASSPORT: 'Passport',
	POSTAL_ID: 'Postal ID',
	VOTERS_ID: "Voter's ID",
	PRC_ID: 'PRC ID',
	STUDENT_ID: 'Student ID',
	COMPANY_ID: 'Company ID',
	BARANGAY_ID: 'Barangay ID',
	OTHER: 'Other ID',
};

/** A PhilHealth Identification Number (`NN-NNNNNNNNN-N`), or the synthetic `SYN-NNNN-NNNN` of the demo data. */
export const PHILHEALTH_PATTERN = /^(\d{2}-\d{9}-\d|SYN-\d{4}-\d{4})$/;
/** A Philippine mobile number: `09XX XXX XXXX` or `+63 9XX XXX XXXX`, spaces and dashes allowed. */
const PH_MOBILE_PATTERN = /^(\+63|0)9\d{9}$/;

/** `+639XXXXXXXXX`, or null when the value isn't a Philippine mobile number. */
export function normalizePhone(value: string): string | null {
	const compact = value.replace(/[\s-]/g, '');
	if (!PH_MOBILE_PATTERN.test(compact)) {
		return null;
	}
	return compact.startsWith('0') ? `+63${compact.slice(1)}` : compact;
}

/** Trimmed, single-spaced and lower-cased: how names are compared for duplicates. */
export const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const today = () => new Date().toISOString().slice(0, 10);

const isCalendarDate = (value: string) => {
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const name = (label: string) =>
	z
		.string()
		.trim()
		.min(1, `Add the ${label}.`)
		.max(PATIENT_NAME_MAX_LENGTH, `Keep the ${label} under ${PATIENT_NAME_MAX_LENGTH} characters.`)
		.transform((value) => value.replace(/\s+/g, ' '));

const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
	z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

export const BirthDateSchema = z
	.string()
	.trim()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
	.refine(isCalendarDate, 'Not a real date.')
	.refine((value) => value >= EARLIEST_BIRTH_DATE, 'The birth date is too far in the past.')
	.refine((value) => value <= today(), 'The birth date cannot be in the future.');

export const PatientDraftSchema = z.object({
	givenName: name('given name').describe('Given (first) name, e.g. Maria.'),
	middleName: optionalText(
		z
			.string()
			.trim()
			.max(PATIENT_NAME_MAX_LENGTH, `Keep the middle name under ${PATIENT_NAME_MAX_LENGTH} characters.`)
			.transform((value) => value.replace(/\s+/g, ' ')),
	).describe("Middle name (the mother's maiden family name), e.g. Reyes."),
	familyName: name('family name').describe('Family (last) name, e.g. Santos.'),
	birthDate: BirthDateSchema.describe('Birth date as YYYY-MM-DD.'),
	sex: z.enum(PATIENT_SEXES, { errorMap: () => ({ message: 'Choose the sex.' }) }).describe('FEMALE or MALE.'),
	phone: optionalText(
		z
			.string()
			.trim()
			.transform((value, ctx) => {
				const phone = normalizePhone(value);
				if (!phone) {
					ctx.addIssue({ code: 'custom', message: 'Use a Philippine mobile number, e.g. 0917 123 4567.' });
					return z.NEVER;
				}
				return phone;
			}),
	).describe('Mobile number, e.g. 0917 123 4567.'),
	preferredLanguage: z
		.enum(PATIENT_LANGUAGES.map((language) => language.value) as [PatientLanguage, ...PatientLanguage[]])
		.default('en'),
	patientNo: optionalText(
		z
			.string()
			.trim()
			.max(PATIENT_NO_MAX_LENGTH, `Keep the patient number under ${PATIENT_NO_MAX_LENGTH} characters.`),
	).describe("The clinic's existing chart number, if the patient has a paper chart; assigned otherwise."),
	philHealthId: optionalText(
		z.string().trim().toUpperCase().regex(PHILHEALTH_PATTERN, 'Use the PhilHealth number format NN-NNNNNNNNN-N.'),
	).describe('PhilHealth Identification Number, NN-NNNNNNNNN-N.'),
	barangayCode: optionalText(z.string().trim().max(20)).describe('PSGC code of the barangay of residence.'),
	addressLine: optionalText(z.string().trim().max(300, 'Keep the address under 300 characters.')).describe(
		'House no., street, purok / sitio.',
	),
});

export type PatientDraft = z.output<typeof PatientDraftSchema>;
export type PatientDraftValues = z.input<typeof PatientDraftSchema>;

/** The first message of each invalid field, keyed by field name, for the form and the card. */
export function patientDraftErrors(values: unknown): Partial<Record<keyof PatientDraft, string>> {
	const parsed = PatientDraftSchema.safeParse(values);
	if (parsed.success) {
		return {};
	}
	const errors: Partial<Record<keyof PatientDraft, string>> = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path[0] as keyof PatientDraft;
		errors[field] ??= issue.message;
	}
	return errors;
}

/** "M. S." — what a clinician sees of a possible duplicate they have no care relationship with. */
export const patientInitials = (givenName: string, familyName: string): string =>
	`${givenName.trim().charAt(0).toUpperCase()}. ${familyName.trim().charAt(0).toUpperCase()}.`;
