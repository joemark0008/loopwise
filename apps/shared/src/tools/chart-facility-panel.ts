import z from 'zod/v3';

import { ChartSpecSchema } from './clinical-chart';

export const PANEL_METRICS = [
	'encounters_by_week',
	'diagnoses_by_icd10_chapter',
	'open_orders_by_age',
	'results_awaiting_review',
] as const;

export type PanelMetric = (typeof PANEL_METRICS)[number];

export const METRIC_LABELS: Record<PanelMetric, string> = {
	encounters_by_week: 'Encounters per week',
	diagnoses_by_icd10_chapter: 'Diagnoses by ICD-10 chapter',
	open_orders_by_age: 'Open orders by age',
	results_awaiting_review: 'Results awaiting review',
};

export const description = [
	"Chart counts across the user's facility, from the patients they may see: encounters_by_week,",
	'diagnoses_by_icd10_chapter (top chapters), open_orders_by_age (sent, not yet resulted) and',
	'results_awaiting_review (by flag). Counts only, never names. For program metrics (time to treatment, referral',
	'completion, equity) point the user to the dashboard instead. facilityId only when the user works at several.',
].join(' ');

export const InputSchema = z.object({
	metric: z.enum(PANEL_METRICS),
	facilityId: z.string().optional().describe('One of your facilities; omit when you work at one.'),
	months: z.number().int().min(1).max(24).optional().describe('How far back, in months (default 6).'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	metric: z.enum(PANEL_METRICS),
	facility: z.object({ id: z.string(), name: z.string() }),
	months: z.number(),
	asOf: z.string(),
	chart: ChartSpecSchema,
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
