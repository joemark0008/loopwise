import z from 'zod/v3';

import { DateOnlySchema } from './encounter-record';

/** Medical certificates (DESIGN.md §5): the one set of rules for the API, the certificate form and the Wise card. */

/** `certificate_type` of the schema, with how the form names each. */
export const CERTIFICATE_TYPES = [
	'MEDICAL_CERTIFICATE',
	'FIT_TO_WORK',
	'MEDICAL_CLEARANCE',
	'PEME_CERTIFICATE',
	'APE_CERTIFICATE',
	'SSS_SICKNESS',
	'VACCINATION_CERTIFICATE',
	'DRIVERS_LICENSE_MEDICAL',
] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
	MEDICAL_CERTIFICATE: 'Medical certificate',
	FIT_TO_WORK: 'Fit to work',
	MEDICAL_CLEARANCE: 'Medical clearance',
	PEME_CERTIFICATE: 'Pre-employment medical exam (PEME)',
	APE_CERTIFICATE: 'Annual physical exam (APE)',
	SSS_SICKNESS: 'SSS sickness benefit',
	VACCINATION_CERTIFICATE: 'Vaccination certificate',
	DRIVERS_LICENSE_MEDICAL: "Driver's license (LTO) medical",
};

export const MAX_REST_DAYS = 90;

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;
const optionalText = (max: number, label: string) =>
	z.preprocess(emptyToUndefined, z.string().trim().max(max, `Keep the ${label} under ${max} characters.`).optional());

export const MedicalCertificateDraftSchema = z
	.object({
		type: z.enum(CERTIFICATE_TYPES).default('MEDICAL_CERTIFICATE'),
		examinedOn: DateOnlySchema.describe('The day the patient was examined, YYYY-MM-DD.'),
		diagnosisText: z
			.string()
			.trim()
			.min(1, 'Add the diagnosis.')
			.max(1000, 'Keep the diagnosis under 1000 characters.')
			.describe('The diagnosis as it should appear on the certificate.'),
		findings: optionalText(2000, 'findings'),
		recommendation: optionalText(1000, 'recommendation').describe('e.g. "Light duty for one week".'),
		isFitToWork: z.preprocess(emptyToUndefined, z.boolean().optional()).describe('Fit to work or school.'),
		restFrom: z.preprocess(emptyToUndefined, DateOnlySchema.optional()).describe('First day of rest.'),
		restDays: z.preprocess(
			emptyToUndefined,
			z.coerce
				.number({ invalid_type_error: 'Rest days must be a number.' })
				.int('Rest days must be a whole number.')
				.min(1, 'Rest days must be at least 1.')
				.max(MAX_REST_DAYS, `Rest days must be at most ${MAX_REST_DAYS}.`)
				.optional(),
		),
		purpose: optionalText(200, 'purpose').describe('e.g. "for school excuse", "for employment requirement".'),
		peClassification: optionalText(40, 'PE classification').describe('PEME / APE: Class A, B, C or Pending.'),
	})
	.superRefine((value, ctx) => {
		if (value.isFitToWork === false && value.restDays === undefined) {
			ctx.addIssue({ code: 'custom', path: ['restDays'], message: 'Say how many days of rest.' });
		}
		if (value.restDays !== undefined && value.restFrom === undefined) {
			ctx.addIssue({ code: 'custom', path: ['restFrom'], message: 'Say from when the rest starts.' });
		}
	});

export type MedicalCertificateDraft = z.output<typeof MedicalCertificateDraftSchema>;

/** The last day of rest, inclusive (`restFrom` + `restDays` − 1), as YYYY-MM-DD. */
export function restUntil(restFrom: string, restDays: number): string {
	const date = new Date(`${restFrom}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + restDays - 1);
	return date.toISOString().slice(0, 10);
}

/** `referral_status` of the schema. */
export const REFERRAL_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED'] as const;
export const REFERRAL_URGENCIES = ['ROUTINE', 'URGENT', 'STAT'] as const;

/**
 * A referral from an encounter: to a practitioner of the organization (`toPractitionerId`), or to an outside doctor
 * and/or facility. One target is required (a check constraint enforces it too).
 */
export const ReferralDraftSchema = z
	.object({
		toPractitionerId: z.preprocess(emptyToUndefined, z.string().uuid('Pick a practitioner.').optional()),
		toExternalDoctor: optionalText(200, 'doctor'),
		toFacility: optionalText(200, 'facility').describe('e.g. "Gov. Celestino Gallares Memorial Medical Center".'),
		specialty: optionalText(120, 'specialty'),
		reason: z
			.string()
			.trim()
			.min(1, 'Add the reason for referral.')
			.max(1000, 'Keep the reason under 1000 characters.'),
		clinicalSummary: optionalText(4000, 'clinical summary'),
		urgency: z.enum(REFERRAL_URGENCIES).default('ROUTINE'),
	})
	.superRefine((value, ctx) => {
		if (!value.toPractitionerId && !value.toExternalDoctor && !value.toFacility) {
			ctx.addIssue({
				code: 'custom',
				path: ['toPractitionerId'],
				message: 'Refer to a practitioner here, or name the outside doctor or facility.',
			});
		}
	});

export type ReferralDraft = z.output<typeof ReferralDraftSchema>;
