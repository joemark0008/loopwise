import { toFiniteNumber } from './chart-values';

/**
 * The blocks of a Wise report (DESIGN.md §7.2), a slim port of loopwise's story segments: markdown that Wise writes,
 * and self-closing tags that embed a tool result of the same chat by its tool call id. The numbers of a report live
 * only in those results; the markdown carries none of its own.
 *
 *   <chart ref="call_123"/>     a chart_patient_trend chart, or a run_analytics_sql / get_metric result with a chart
 *   <table ref="call_123"/>     a run_analytics_sql / get_metric result as a table
 *   <sections ref="call_123"/>  the data sections of a create_report summary
 *   <kpi ref="call_123" column="visits" compare="percentage" label="Visits"/>
 *                               the last row of a run_analytics_sql / get_metric result as a headline number, with
 *                               the change from the row before it (compare: percentage, variation or absolute)
 *
 * Layout, as in loopwise's stories:
 *
 *   <grid widths="2,1">…</grid> 2–4 blocks side by side (no prose inside); widths are relative, one per block
 *   <tab title="…">…</tab>      top-level tabs; a report with tabs is made of tabs only, and tabs don't nest
 */
export const REPORT_BLOCK_KINDS = ['chart', 'table', 'sections', 'kpi'] as const;
export type ReportBlockKind = (typeof REPORT_BLOCK_KINDS)[number];

export const KPI_COMPARE_MODES = ['percentage', 'variation', 'absolute'] as const;
export type KpiCompareMode = (typeof KPI_COMPARE_MODES)[number];

export type ReportBlock =
	| { kind: 'chart' | 'table' | 'sections'; ref: string }
	| { kind: 'kpi'; ref: string; column?: string; compare?: KpiCompareMode; label?: string };

export type ReportSegment =
	{ kind: 'markdown'; text: string } | ReportBlock | { kind: 'grid'; widths: number[] | null; blocks: ReportBlock[] };

/** A tab of a report; a report without tabs is one tab with no title. */
export interface ReportTab {
	title: string | null;
	segments: ReportSegment[];
}

/** The tools whose results a report may embed, by block kind. */
export const REPORT_BLOCK_TOOLS: Record<ReportBlockKind, readonly string[]> = {
	chart: ['chart_patient_trend', 'chart_facility_panel', 'run_analytics_sql', 'get_metric'],
	table: ['run_analytics_sql', 'get_metric'],
	sections: ['create_report'],
	kpi: ['run_analytics_sql', 'get_metric'],
};

export const GRID_MIN_BLOCKS = 2;
export const GRID_MAX_BLOCKS = 4;

/** A report whose layout tags don't parse; the message tells Wise what to fix. */
export class ReportSyntaxError extends Error {}

const TAB = /<tab\b([^>]*)>([\s\S]*?)<\/tab\s*>/g;
const BODY = /<grid\b([^>]*)>([\s\S]*?)<\/grid\s*>|<(chart|table|sections|kpi)\b([^>]*?)\/?>(?:\s*<\/\3\s*>)?/g;
const BLOCK = /<(chart|table|sections|kpi)\b([^>]*?)\/?>(?:\s*<\/\1\s*>)?/g;
const ATTR = /([a-z_]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function attributes(text: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	for (const match of text.matchAll(ATTR)) {
		attrs[match[1].toLowerCase()] = (match[2] ?? match[3]).trim();
	}
	return attrs;
}

function parseBlock(kind: ReportBlockKind, attrText: string): ReportBlock {
	const attrs = attributes(attrText);
	if (!attrs.ref) {
		throw new ReportSyntaxError(`<${kind}> needs ref="<tool call id>".`);
	}
	if (kind !== 'kpi') {
		return { kind, ref: attrs.ref };
	}
	if (attrs.compare && !(KPI_COMPARE_MODES as readonly string[]).includes(attrs.compare)) {
		throw new ReportSyntaxError(`<kpi compare="${attrs.compare}"> must be one of ${KPI_COMPARE_MODES.join(', ')}.`);
	}
	return {
		kind,
		ref: attrs.ref,
		...(attrs.column && { column: attrs.column }),
		...(attrs.compare && { compare: attrs.compare as KpiCompareMode }),
		...(attrs.label && { label: attrs.label }),
	};
}

function parseGrid(attrText: string, inner: string): ReportSegment {
	if (/<(grid|tab)\b/.test(inner)) {
		throw new ReportSyntaxError('A <grid> holds blocks only; grids and tabs do not nest inside it.');
	}
	const blocks: ReportBlock[] = [];
	let last = 0;
	for (const match of inner.matchAll(BLOCK)) {
		if (inner.slice(last, match.index).trim()) {
			throw new ReportSyntaxError('A <grid> holds blocks only; put text above or below it.');
		}
		blocks.push(parseBlock(match[1] as ReportBlockKind, match[2]));
		last = (match.index ?? 0) + match[0].length;
	}
	if (inner.slice(last).trim()) {
		throw new ReportSyntaxError('A <grid> holds blocks only; put text above or below it.');
	}
	if (blocks.length < GRID_MIN_BLOCKS || blocks.length > GRID_MAX_BLOCKS) {
		throw new ReportSyntaxError(
			`A <grid> places ${GRID_MIN_BLOCKS}–${GRID_MAX_BLOCKS} blocks side by side; this one has ${blocks.length}.`,
		);
	}
	const { widths } = attributes(attrText);
	if (widths === undefined) {
		return { kind: 'grid', widths: null, blocks };
	}
	const values = widths.split(',').map((value) => value.trim());
	if (values.length !== blocks.length || values.some((value) => !/^([1-9]|1[0-2])$/.test(value))) {
		throw new ReportSyntaxError(
			`<grid widths="${widths}"> needs one whole number from 1 to 12 per block (${blocks.length}), e.g. "2,1".`,
		);
	}
	return { kind: 'grid', widths: values.map(Number), blocks };
}

function parseBody(code: string): ReportSegment[] {
	if (/<\/?tab\b/.test(code)) {
		throw new ReportSyntaxError('Tabs do not nest, and a <tab> must be closed with </tab>.');
	}
	const segments: ReportSegment[] = [];
	let last = 0;
	const pushText = (text: string) => {
		if (/<\/?grid\b/.test(text)) {
			throw new ReportSyntaxError('Every <grid> must be closed with </grid>.');
		}
		if (text.trim()) {
			segments.push({ kind: 'markdown', text });
		}
	};
	for (const match of code.matchAll(BODY)) {
		pushText(code.slice(last, match.index));
		segments.push(
			match[3] ? parseBlock(match[3] as ReportBlockKind, match[4]) : parseGrid(match[1] ?? '', match[2] ?? ''),
		);
		last = (match.index ?? 0) + match[0].length;
	}
	pushText(code.slice(last));
	return segments;
}

/**
 * A report's tabs, each with its markdown, blocks and grids in order. Throws a `ReportSyntaxError` when the layout
 * tags are malformed: the `report` tool refuses such a report, so a saved one always parses.
 */
export function parseReport(code: string): ReportTab[] {
	if (!/<tab\b/.test(code)) {
		return [{ title: null, segments: parseBody(code) }];
	}
	const tabs: ReportTab[] = [];
	let last = 0;
	for (const match of code.matchAll(TAB)) {
		if (code.slice(last, match.index).trim()) {
			throw new ReportSyntaxError('A report with tabs is made of <tab title="…">…</tab> blocks only.');
		}
		const { title } = attributes(match[1]);
		if (!title) {
			throw new ReportSyntaxError('Every <tab> needs a title="…".');
		}
		tabs.push({ title, segments: parseBody(match[2]) });
		last = (match.index ?? 0) + match[0].length;
	}
	if (code.slice(last).trim()) {
		throw new ReportSyntaxError(
			'A report with tabs is made of <tab title="…">…</tab> blocks only, each closed with </tab>.',
		);
	}
	return tabs;
}

/** Every block of a report, in grids and tabs too, in order. */
export function reportBlocks(code: string): ReportBlock[] {
	return parseReport(code).flatMap((tab) =>
		tab.segments.flatMap((segment) =>
			segment.kind === 'markdown' ? [] : segment.kind === 'grid' ? segment.blocks : [segment],
		),
	);
}

/**
 * The text of a report that Wise wrote itself: its markdown, tab titles and KPI labels, without the blocks. This is
 * what the number guard reads.
 */
export function reportProse(code: string): string {
	return parseReport(code)
		.flatMap((tab) => [
			tab.title ?? '',
			...tab.segments.flatMap((segment) => {
				if (segment.kind === 'markdown') {
					return [segment.text];
				}
				const blocks = segment.kind === 'grid' ? segment.blocks : [segment];
				return blocks.map((block) => (block.kind === 'kpi' ? (block.label ?? '') : ''));
			}),
		])
		.filter(Boolean)
		.join('\n');
}

/** The table-shaped output of a run_analytics_sql or get_metric result, which a KPI reads. */
export interface KpiSource {
	columns: string[];
	rows: unknown[][];
}

/** A KPI resolved against its result: the column, the latest value and the rows as records, oldest first. */
export interface ResolvedKpi {
	column: string;
	/** The column the rows are ordered by (the period), when the result has one. */
	periodColumn: string | null;
	value: number;
	data: Record<string, unknown>[];
}

/**
 * Resolves a `<kpi>` block against the result it embeds, or explains why it can't: the value is the last row of the
 * column (the only numeric column when none is named), and a comparison needs a row before it.
 */
export function resolveKpi(
	block: Extract<ReportBlock, { kind: 'kpi' }>,
	source: KpiSource,
): ResolvedKpi | { problem: string } {
	const { columns, rows } = source;
	const numeric = columns.filter((_, index) => rows.some((row) => toFiniteNumber(row[index]) != null));
	const column = block.column ?? (numeric.length === 1 ? numeric[0] : undefined);
	if (!column) {
		return {
			problem: `<kpi ref="${block.ref}"> needs column="…": the result has ${numeric.length === 0 ? 'no numeric column' : `several (${numeric.join(', ')})`}.`,
		};
	}
	const index = columns.indexOf(column);
	if (index < 0) {
		return { problem: `<kpi column="${column}"> is not a column of that result (${columns.join(', ')}).` };
	}
	if (rows.length === 0) {
		return { problem: `<kpi ref="${block.ref}"> embeds a result with no rows.` };
	}
	const value = toFiniteNumber(rows[rows.length - 1][index]);
	if (value == null) {
		return { problem: `<kpi column="${column}"> has no number in the last row (empty or suppressed).` };
	}
	if (block.compare && rows.length < 2) {
		return {
			problem: `<kpi compare="${block.compare}"> needs at least two rows, one per period, oldest first; drop compare or change the query.`,
		};
	}
	const periodColumn = columns.find((name, at) => at !== index && !numeric.includes(name)) ?? null;
	const data = rows.map((row) => Object.fromEntries(columns.map((name, at) => [name, row[at]])));
	return { column, periodColumn, value, data };
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
