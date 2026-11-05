import z from 'zod/v3';

import { DateOnlySchema } from './encounter-record';

/** Medical certificates (DESIGN.md §5): the one set of rules for the API, the certificate form and the Wise card. */
export const WORK_FITNESS = ['fit_to_work', 'fit_with_restrictions', 'unfit'] as const;
export type WorkFitness = (typeof WORK_FITNESS)[number];

export const WORK_FITNESS_LABELS: Record<WorkFitness, string> = {
	fit_to_work: 'Fit to work',
	fit_with_restrictions: 'Fit to work, with restrictions',
	unfit: 'Unfit to work',
};

export const MAX_REST_DAYS = 90;

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

export const MedicalCertificateDraftSchema = z
	.object({
		examinedOn: DateOnlySchema.describe('The day the patient was examined, YYYY-MM-DD.'),
		diagnosisText: z
			.string()
			.trim()
			.min(1, 'Add the diagnosis.')
			.max(1000, 'Keep the diagnosis under 1000 characters.')
			.describe('The diagnosis as it should appear on the certificate.'),
		fitness: z.enum(WORK_FITNESS).default('fit_to_work'),
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
		remarks: z.preprocess(
			emptyToUndefined,
			z.string().trim().max(1000, 'Keep the remarks under 1000 characters.').optional(),
		),
		purpose: z.preprocess(
			emptyToUndefined,
			z.string().trim().max(200, 'Keep the purpose under 200 characters.').optional(),
		),
	})
	.superRefine((value, ctx) => {
		if (value.fitness === 'unfit' && value.restDays === undefined) {
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
