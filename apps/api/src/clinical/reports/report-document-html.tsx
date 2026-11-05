import { buildAnalyticsChart } from '@loopwise/shared/analytics-chart';
import { DEFAULT_COLORS } from '@loopwise/shared/chart-builder';
import { parseReport, type ReportBlock, type ReportSegment } from '@loopwise/shared/report-blocks';
import { kpiDisplay } from '@loopwise/shared/report-kpi';
import type { clinicalChart, createReport, report, runAnalyticsSql } from '@loopwise/shared/tools';
import { Marked } from 'marked';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { chartSvg, escapeHtml, formatDateTime, SectionBlock, STYLES } from '../insights/report-pdf/report-html.js';

/** A tool result a report block embeds. */
export interface EmbeddedResult {
	toolName: string;
	output: unknown;
}

const WATERMARK = 'Synthetic data — prototype';

/** Model-written markdown never becomes raw HTML in the PDF. */
const markdown = new Marked({ gfm: true, renderer: { html: ({ text }) => escapeHtml(text) } });

/**
 * A Wise report (the `report` tool, DESIGN.md §7.2) as one static HTML page for headless Chrome: its markdown, and
 * its blocks drawn from the embedded tool results as server-side SVG charts and tables.
 */
export function renderReportDocumentHtml(
	doc: report.Output,
	results: Map<string, EmbeddedResult>,
	meta: { generatedAt: string; generatedBy: string },
): string {
	const body = parseReport(doc.code)
		.map((tab) => {
			const segments = tab.segments.map((segment) => renderSegment(segment, results)).join('\n');
			return tab.title === null
				? segments
				: `<div class="tab"><h2 class="tab-title">${escapeHtml(tab.title)}</h2>${segments}</div>`;
		})
		.join('\n');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${STYLES}
.prose h1, .prose h2, .prose h3 { margin: 10pt 0 4pt; } .prose p { margin: 0 0 6pt; line-height: 1.5; }
.prose ul, .prose ol { margin: 0 0 6pt 14pt; padding: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; font-size: 8pt; color: #475569; margin: 4pt 0 0; }
.legend i { display: inline-block; width: 8pt; height: 8pt; margin-right: 4pt; border-radius: 2pt; }
.tab + .tab { break-before: page; }
.tab-title { font-size: 13pt; border-bottom: 1pt solid #cbd5e1; padding-bottom: 3pt; margin: 4pt 0 8pt; }
.grid { display: grid; gap: 10pt; margin: 0 0 11pt; break-inside: avoid; }
.grid > section { margin: 0; min-width: 0; }
.kpi { border: 1pt solid #cbd5e1; border-radius: 4pt; padding: 7pt 9pt; }
.kpi h2 { font-size: 8.5pt; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 2pt; }
.kpi-value { font-family: Manrope, Inter, system-ui, sans-serif; font-size: 20pt; font-weight: 800; margin: 0;
  font-variant-numeric: tabular-nums; }
.kpi-change { font-size: 8pt; color: #475569; margin: 2pt 0 0; }</style></head><body><main>
<div class="watermark">${escapeHtml(WATERMARK)}</div>
<header><div class="brand">Loopwise</div><h1>${escapeHtml(doc.title)}</h1>
<p class="meta">Version ${doc.version} · generated ${escapeHtml(formatDateTime(meta.generatedAt))} by ${escapeHtml(meta.generatedBy)} · narrative drafted by Wise, verify against the data</p></header>
${body}
</main></body></html>`;
}

function renderSegment(segment: ReportSegment, results: Map<string, EmbeddedResult>): string {
	if (segment.kind === 'markdown') {
		return `<section class="prose">${markdown.parse(segment.text, { async: false })}</section>`;
	}
	if (segment.kind === 'grid') {
		const columns = (segment.widths ?? segment.blocks.map(() => 1))
			.map((width) => `minmax(0, ${width}fr)`)
			.join(' ');
		const blocks = segment.blocks.map((block) => renderBlock(block, results)).join('');
		return `<div class="grid" style="grid-template-columns: ${columns}">${blocks}</div>`;
	}
	return renderBlock(segment, results);
}

function renderBlock(block: ReportBlock, results: Map<string, EmbeddedResult>): string {
	const result = results.get(block.ref);
	if (!result) {
		return '<p class="empty">This block refers to a result that is no longer in the chat.</p>';
	}
	const output = result.output as Record<string, unknown>;
	if (block.kind === 'kpi') {
		return kpi(block, output as unknown as runAnalyticsSql.Output);
	}
	if (block.kind === 'sections') {
		const sections = (output as createReport.Output).snapshot.sections;
		return renderToStaticMarkup(
			<>
				{sections.map((section, index) => (
					<SectionBlock key={index} section={section} />
				))}
			</>,
		);
	}
	if (block.kind === 'chart' && 'chart' in output && output.chart && 'chartType' in (output.chart as object)) {
		const chart = output.chart as clinicalChart.ChartSpec;
		return figure(chart.title, chart.rows.length > 0 ? chartSvg(chart) : null);
	}
	const analytics = output as unknown as runAnalyticsSql.Output & { label?: string };
	const title = analytics.label ?? analytics.purpose ?? '';
	if (block.kind === 'chart' && analytics.chart) {
		return figure(analytics.chart.title ?? title, analyticsChartSvg(analytics, analytics.chart));
	}
	return `<section><h2>${escapeHtml(title)}</h2>${table(analytics.columns, analytics.rows)}</section>`;
}

const ARROWS = { up: '▲', down: '▼', flat: '■' } as const;

function kpi(block: Extract<ReportBlock, { kind: 'kpi' }>, output: runAnalyticsSql.Output): string {
	const shown = kpiDisplay(block, output);
	if ('problem' in shown) {
		return `<p class="empty">${escapeHtml(shown.problem)}</p>`;
	}
	const change = shown.comparison
		? `<p class="kpi-change">${ARROWS[shown.comparison.direction]} ${escapeHtml(shown.comparison.valueText)} vs. ${escapeHtml(shown.comparison.periodLabel)}</p>`
		: '';
	return `<section class="kpi"><h2>${escapeHtml(shown.label)}</h2><p class="kpi-value">${escapeHtml(shown.valueText)}</p>${change}</section>`;
}

const figure = (title: string, svg: string | null) =>
	`<section class="chart"><h2>${escapeHtml(title)}</h2>${svg ?? '<p class="empty">No data in this period.</p>'}</section>`;

function table(columns: string[], rows: runAnalyticsSql.Cell[][]): string {
	if (rows.length === 0) {
		return '<p class="empty">No rows.</p>';
	}
	const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
	const body = rows
		.map(
			(row) =>
				`<tr>${row.map((cell) => `<td>${escapeHtml(cell === null ? '—' : String(cell))}</td>`).join('')}</tr>`,
		)
		.join('');
	return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** An analytics chart of any type, drawn by the shared builder at a fixed size, with a legend of its series. */
export function analyticsChartSvg(output: runAnalyticsSql.Output, chart: runAnalyticsSql.ResultChart): string {
	const svg = renderToStaticMarkup(
		buildAnalyticsChart(chart, output.columns, output.rows, {
			width: 680,
			height: chart.type === 'sankey' ? 320 : 260,
		}),
	);
	const legend =
		chart.y.length > 1 || (chart.references?.length ?? 0) > 0
			? `<p class="legend">${[
					...chart.y.map(
						(column, index) =>
							`<span><i style="background:${DEFAULT_COLORS[index % DEFAULT_COLORS.length]}"></i>${escapeHtml(column.replaceAll('_', ' '))}</span>`,
					),
					...(chart.references ?? [])
						.filter((reference) => reference.value !== undefined)
						.map((reference) => `<span>— ${escapeHtml(reference.label)}</span>`),
				].join('')}</p>`
			: '';
	return svg + legend;
}
