import type { DiagnosticReportFieldsFragment, ResultUrgency } from '@/graphql/generated/graphql';

type Value = DiagnosticReportFieldsFragment['values'][number];

/** `7.2 %`. */
export const valueText = (value: Pick<Value, 'value' | 'unit'>) =>
	value.unit ? `${value.value} ${value.unit}` : value.value;

/**
 * The result in one line: the value of a one-analyte test (`7.2 %`), the out-of-range analytes of a panel
 * (`Hemoglobin 11.2 g/dL, …`, else `All within range`), or an imaging report's impression.
 */
export function resultSummary(
	report: Pick<DiagnosticReportFieldsFragment, 'values' | 'impression' | 'findings'>,
): string {
	if (report.values.length === 0) {
		return report.impression ?? report.findings?.split('\n')[0] ?? 'Report';
	}
	if (report.values.length === 1) {
		return valueText(report.values[0]);
	}
	const flagged = report.values.filter((value) => value.flag && value.flag !== 'NORMAL');
	return flagged.length === 0
		? 'All within range'
		: flagged.map((value) => `${value.name} ${valueText(value)}`).join(', ');
}

/** The reference range shown beside a one-analyte result. */
export const referenceRange = (report: Pick<DiagnosticReportFieldsFragment, 'values'>) =>
	report.values.length === 1 ? report.values[0].referenceRange : null;

/** The inbox's group headings, in its order (the server sorts critical, abnormal, unflagged, normal). */
export const URGENCY_LABELS: Record<ResultUrgency, string> = {
	CRITICAL: 'Critical',
	ABNORMAL: 'Abnormal',
	UNFLAGGED: 'No flag: read the report',
	NORMAL: 'Normal',
};
