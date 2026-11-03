import z from 'zod/v3';

import { ANALYTICS_CHART_TYPES, CellSchema, ResultChartOutputSchema } from './run-analytics-sql';

/**
 * Certified metrics (DESIGN.md §12): one fixed definition each, over the analytics views, so Wise, the dashboard and
 * reports report the same number.
 */
export const METRICS = [
	'panel_size',
	'patients_by_age_band',
	'patients_by_sex',
	'patients_by_barangay',
	'new_patients',
	'encounters',
	'top_diagnoses',
	'results_awaiting_review',
	'open_orders',
	'overdue_follow_ups',
	'rx_issued',
	'billing_totals',
	'screening_funnel',
] as const;

export type Metric = (typeof METRICS)[number];

export const description = [
	"Get a certified metric of the user's own patients, with one fixed definition: panel_size, patients_by_age_band,",
	'patients_by_sex, patients_by_barangay, new_patients (first visit in the period), encounters (per week or month),',
	'top_diagnoses (by code or ICD-10 chapter), results_awaiting_review, open_orders (by age), overdue_follow_ups,',
	'rx_issued, billing_totals and screening_funnel (orders in the period: ordered → resulted → reviewed → actioned, as',
	'a funnel). Prefer it to run_analytics_sql whenever it answers the question. Audited.',
].join(' ');

export const InputSchema = z.object({
	metric: z.enum(METRICS),
	months: z.number().int().min(1).max(60).optional().describe('Period, in months back from today (default 12).'),
	groupBy: z
		.enum(['week', 'month', 'code', 'chapter'])
		.optional()
		.describe('encounters: week or month (default month); top_diagnoses: code or chapter (default code).'),
	chart: z
		.enum([...ANALYTICS_CHART_TYPES, 'none'])
		.optional()
		.describe(
			"Chart type when the user asks for a chart or graph; 'none' for a table only. Default: the metric's own.",
		),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	metric: z.enum(METRICS),
	label: z.string(),
	definition: z.string(),
	/** The period in months, for metrics that have one (null for a count of today's panel, say). */
	months: z.number().nullable(),
	sql: z.string(),
	columns: z.array(z.string()),
	rows: z.array(z.array(CellSchema)),
	suppressed: z.boolean(),
	chart: ResultChartOutputSchema.nullable().optional(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
