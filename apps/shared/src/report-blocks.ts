/**
 * The blocks of a Wise report (DESIGN.md §7.2), a slim port of loopwise's story segments: markdown that Wise writes,
 * and self-closing tags that embed a tool result of the same chat by its tool call id. The numbers of a report live
 * only in those results; the markdown carries none of its own.
 *
 *   <chart ref="call_123"/>     a chart_patient_trend chart, or a run_analytics_sql / get_metric result with a chart
 *   <table ref="call_123"/>     a run_analytics_sql / get_metric result as a table
 *   <sections ref="call_123"/>  the data sections of a create_report summary
 */
export const REPORT_BLOCK_KINDS = ['chart', 'table', 'sections'] as const;
export type ReportBlockKind = (typeof REPORT_BLOCK_KINDS)[number];

export type ReportSegment = { kind: 'markdown'; text: string } | { kind: ReportBlockKind; ref: string };

/** The tools whose results a report may embed, by block kind. */
export const REPORT_BLOCK_TOOLS: Record<ReportBlockKind, readonly string[]> = {
	chart: ['chart_patient_trend', 'chart_facility_panel', 'run_analytics_sql', 'get_metric'],
	table: ['run_analytics_sql', 'get_metric'],
	sections: ['create_report'],
};

const BLOCK = /<(chart|table|sections)\s+ref\s*=\s*["']([^"']+)["']\s*\/?>(?:\s*<\/\1>)?/g;

export function splitReport(code: string): ReportSegment[] {
	const segments: ReportSegment[] = [];
	let last = 0;
	for (const match of code.matchAll(BLOCK)) {
		const text = code.slice(last, match.index);
		if (text.trim()) {
			segments.push({ kind: 'markdown', text });
		}
		segments.push({ kind: match[1] as ReportBlockKind, ref: match[2] });
		last = (match.index ?? 0) + match[0].length;
	}
	const rest = code.slice(last);
	if (rest.trim()) {
		segments.push({ kind: 'markdown', text: rest });
	}
	return segments;
}

/** The markdown of a report without its blocks: what the number guard reads. */
export function reportProse(code: string): string {
	return splitReport(code)
		.filter((segment): segment is { kind: 'markdown'; text: string } => segment.kind === 'markdown')
		.map((segment) => segment.text)
		.join('\n');
}

const NUMBER = /\d+(?:[.,]\d+)?/g;
const normalizeNumber = (value: string) => {
	const parsed = Number(value.replace(',', '.'));
	return Number.isFinite(parsed) ? String(parsed) : value;
};

/** Every number in the embedded results (cell values, chart points, section text), normalized (`7.20` → `7.2`). */
export function resultNumbers(results: unknown[]): Set<string> {
	const numbers = new Set<string>();
	const walk = (value: unknown) => {
		if (typeof value === 'number') {
			numbers.add(normalizeNumber(String(value)));
		} else if (typeof value === 'string') {
			for (const match of value.match(NUMBER) ?? []) {
				numbers.add(normalizeNumber(match));
			}
		} else if (Array.isArray(value)) {
			value.forEach(walk);
		} else if (value && typeof value === 'object') {
			Object.values(value).forEach(walk);
		}
	};
	results.forEach(walk);
	return numbers;
}

/**
 * The numbers of a report's prose that none of its embedded results contains. Small counts (0–10) and years are
 * allowed: they read as words ("two patients", "in 2026") more than as data.
 */
export function ungroundedProseNumbers(code: string, results: unknown[]): string[] {
	const known = resultNumbers(results);
	const found = (reportProse(code).match(NUMBER) ?? []).map(normalizeNumber);
	return [
		...new Set(
			found.filter(
				(value) =>
					!known.has(value) && !(/^\d+$/.test(value) && Number(value) <= 10) && !/^(19|20)\d\d$/.test(value),
			),
		),
	];
}
