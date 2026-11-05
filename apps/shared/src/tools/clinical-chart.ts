import z from 'zod/v3';

import { SeriesConfigSchema } from './display-chart';

/**
 * A chart the server builds from a fixed clinical dataset (DESIGN.md §7.2): Wise picks the dataset, never the numbers
 * or the axes. The chat card and the report PDF both draw it with the shared `buildChart`.
 */
export const ChartSpecSchema = z.object({
	title: z.string(),
	chartType: z.enum(['line', 'bar', 'horizontal_bar', 'mixed']),
	xAxisKey: z.string(),
	series: z.array(SeriesConfigSchema),
	rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))),
	unit: z.string(),
	yAxisLabel: z.string().optional(),
	yAxisRightLabel: z.string().optional(),
});

export type ChartSpec = z.infer<typeof ChartSpecSchema>;

/** Colors of the chart series, the same in the chat and the PDF (the PDF can't resolve the app's CSS variables). */
export const CHART_COLORS = {
	primary: '#2563eb',
	secondary: '#0d9488',
	threshold: '#d97706',
} as const;

/** The points a model is told about: all of them up to `max`, else the first, last, lowest and highest. */
export function summarizeRows(spec: ChartSpec, max = 24): string {
	const keys = spec.series.map((series) => series.data_key);
	const line = (row: ChartSpec['rows'][number]) =>
		`${row[spec.xAxisKey]}: ${keys
			.filter((key) => row[key] !== null && row[key] !== undefined)
			.map((key) => `${spec.series.find((series) => series.data_key === key)?.label ?? key} ${row[key]}`)
			.join(', ')}`;
	if (spec.rows.length <= max) {
		return spec.rows.map(line).join('\n');
	}
	const first = keys[0];
	const sorted = [...spec.rows].sort((a, b) => Number(a[first] ?? 0) - Number(b[first] ?? 0));
	return [
		`${spec.rows.length} points; showing first, last, lowest and highest ${spec.series[0]?.label ?? first}:`,
		line(spec.rows[0]),
		line(spec.rows[spec.rows.length - 1]),
		line(sorted[0]),
		line(sorted[sorted.length - 1]),
	].join('\n');
}
