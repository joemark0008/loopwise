import z from 'zod/v3';

/** Rows the model sees; the card gets up to `MAX_ROWS`. */
export const SAMPLE_ROWS = 50;
export const MAX_ROWS = 5000;

export const description = [
	"Run one read-only SQL SELECT over the `analytics` views of the user's own patients (call describe_analytics",
	'first for the views and columns). Postgres runs it as the user: it only ever sees their patients. Only SELECT',
	'(with CTEs, joins, window functions) on analytics views and plain functions; no other schema, no writes. You get',
	`the columns and up to ${SAMPLE_ROWS} rows; the user sees the full table (up to ${MAX_ROWS} rows) and can view the`,
	'query. To show a chart, pass `chart` with columns of the result: bar (grouped when several y), stacked_bar,',
	'stacked_bar_100, horizontal_bar(_100), line, area, stacked_area(_100), composed (bars + lines, two axes), scatter',
	'(x and y numeric), bubble (+ size), pie, donut, radar, radial_bar, treemap, funnel (ordered steps), sankey (x',
	'source, target, y value); add thresholds by key to draw clinical cut-offs. Prefer get_metric for headline numbers. If the query is refused, read the reason and fix it. Every query is',
	'recorded in the audit log.',
].join(' ');

/** Chart types an analytics result can be drawn as (a subset of the shared chart builder's). */
/**
 * Every chart an analytics result can be drawn as: Recharts' cartesian charts (grouped, stacked and 100% bars, lines,
 * areas, composed bar + line on two axes, scatter and bubble), and its pie, donut, radar, radial bar, treemap, funnel
 * and Sankey charts.
 */
export const ANALYTICS_CHART_TYPES = [
	'bar',
	'stacked_bar',
	'stacked_bar_100',
	'horizontal_bar',
	'horizontal_bar_100',
	'line',
	'area',
	'stacked_area',
	'stacked_area_100',
	'composed',
	'scatter',
	'bubble',
	'pie',
	'donut',
	'radar',
	'radial_bar',
	'treemap',
	'funnel',
	'sankey',
] as const;

export type AnalyticsChartType = (typeof ANALYTICS_CHART_TYPES)[number];

/**
 * Clinical thresholds a chart may draw, by key, never by number: the server resolves them from the active pathways'
 * bands (by LOINC code, e.g. 4548-4 for HbA1c) or the fixed BP cut-offs ("bp": 140/90).
 */
export const ThresholdKeySchema = z.string().regex(/^(bp|[0-9]{1,6}-[0-9])$/);

/**
 * A chart of the result's own rows, checked against the result on the server, so a chart can only show numbers the
 * query returned (and thresholds the pathways define).
 */
export const ResultChartSchema = z.object({
	type: z.enum(ANALYTICS_CHART_TYPES),
	x: z
		.string()
		.describe(
			'Result column for the x axis, the categories (pie/donut/radar/radial_bar/treemap/funnel steps), a numeric x (scatter/bubble), or the source node (sankey).',
		),
	y: z
		.array(z.string())
		.min(1)
		.max(6)
		.describe(
			'Numeric result columns to plot; exactly one for scatter, bubble, pie, donut, radial_bar, treemap, funnel, sankey.',
		),
	size: z.string().optional().describe('bubble: the numeric column sizing each point.'),
	target: z.string().optional().describe('sankey: the target node column (x is the source, y the flow value).'),
	series: z
		.record(z.object({ as: z.enum(['bar', 'line', 'area']), axis: z.enum(['left', 'right']).optional() }))
		.optional()
		.describe(
			'composed: how each y column is drawn and on which axis, e.g. {"visits":{"as":"bar"},"avg_hba1c":{"as":"line","axis":"right"}}.',
		),
	thresholds: z
		.array(ThresholdKeySchema)
		.max(4)
		.optional()
		.describe(
			'Clinical thresholds to draw as reference lines and bands: a LOINC code of a pathway (4548-4 HbA1c, 1558-6 FBS) or "bp".',
		),
	title: z.string().max(120).optional(),
});

/** A reference line (value) or band (from–to) the server resolved from a threshold key. */
export const ChartReferenceSchema = z.object({
	label: z.string(),
	axis: z.enum(['x', 'y']),
	value: z.number().optional(),
	from: z.number().optional(),
	to: z.number().optional(),
	tone: z.enum(['normal', 'actionable', 'critical']).optional(),
});

export type ChartReference = z.infer<typeof ChartReferenceSchema>;

/** The chart as stored with the result: the request, plus the references the server resolved. */
export const ResultChartOutputSchema = ResultChartSchema.extend({
	references: z.array(ChartReferenceSchema).optional(),
});

export type ResultChart = z.infer<typeof ResultChartOutputSchema>;
export type ResultChartInput = z.infer<typeof ResultChartSchema>;

export const InputSchema = z.object({
	sql: z
		.string()
		.min(1)
		.max(8000)
		.describe('One SELECT over analytics views, e.g. SELECT sex, count(*) FROM patients GROUP BY sex'),
	purpose: z.string().max(200).describe('What the query answers, in a few words (shown to the user and audited).'),
	chart: ResultChartSchema.optional().describe(
		'Draw the result as a chart, from its own columns, when the user asks for a chart or a graph.',
	),
});

export const CellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	purpose: z.string(),
	sql: z.string(),
	columns: z.array(z.string()),
	rows: z.array(z.array(CellSchema)),
	rowCount: z.number(),
	/** More rows matched than `MAX_ROWS`. */
	truncated: z.boolean(),
	/** Counts under 5 shown as "<5" (program users only). */
	suppressed: z.boolean(),
	chart: ResultChartOutputSchema.nullable().optional(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Cell = z.infer<typeof CellSchema>;
