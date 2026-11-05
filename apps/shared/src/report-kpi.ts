import { computeKpiComparison, type KpiComparison } from './chart-builder';
import { formatChartValue } from './chart-values';
import { type KpiSource, type ReportBlock, resolveKpi } from './report-blocks';

/** A `<kpi>` block ready to draw: the same value and comparison in the report panel and the PDF. */
export interface KpiDisplay {
	label: string;
	value: number;
	valueText: string;
	comparison: KpiComparison | null;
}

/** Draws a `<kpi>` block from the result it embeds; a problem when the result can't show it (see `resolveKpi`). */
export function kpiDisplay(
	block: Extract<ReportBlock, { kind: 'kpi' }>,
	source: KpiSource,
): KpiDisplay | { problem: string } {
	const kpi = resolveKpi(block, source);
	if ('problem' in kpi) {
		return kpi;
	}
	return {
		label: block.label ?? kpi.column.replaceAll('_', ' '),
		value: kpi.value,
		valueText: formatChartValue(kpi.value),
		comparison: computeKpiComparison(kpi.data, kpi.periodColumn ?? '', kpi.column, block.compare),
	};
}
