import { buildAnalyticsChart } from '@loopwise/shared/analytics-chart';
import { DEFAULT_COLORS } from '@loopwise/shared/chart-builder';
import { type ReportSegment, splitReport } from '@loopwise/shared/report-blocks';
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
 * A Wise report (the `report` tool, DESIGN.md §9.2) as one static HTML page for headless Chrome: its markdown, and
 * its blocks drawn from the embedded tool results as server-side SVG charts and tables.
 */
export function renderReportDocumentHtml(
	doc: report.Output,
	results: Map<string, EmbeddedResult>,
	meta: { generatedAt: string; generatedBy: string },
): string {
	const body = splitReport(doc.code)
		.map((segment) => renderSegment(segment, results))
		.join('\n');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${STYLES}
.prose h1, .prose h2, .prose h3 { margin: 10pt 0 4pt; } .prose p { margin: 0 0 6pt; line-height: 1.5; }
.prose ul, .prose ol { margin: 0 0 6pt 14pt; padding: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 4pt 12pt; font-size: 8pt; color: #475569; margin: 4pt 0 0; }
.legend i { display: inline-block; width: 8pt; height: 8pt; margin-right: 4pt; border-radius: 2pt; }</style></head><body><main>
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
	const result = results.get(segment.ref);
	if (!result) {
		return '<p class="empty">This block refers to a result that is no longer in the chat.</p>';
	}
	const output = result.output as Record<string, unknown>;
	if (segment.kind === 'sections') {
		const sections = (output as createReport.Output).snapshot.sections;
		return renderToStaticMarkup(
			<>
				{sections.map((section, index) => (
					<SectionBlock key={index} section={section} />
				))}
			</>,
		);
	}
	if (segment.kind === 'chart' && 'chart' in output && output.chart && 'chartType' in (output.chart as object)) {
		const chart = output.chart as clinicalChart.ChartSpec;
		return figure(chart.title, chart.rows.length > 0 ? chartSvg(chart) : null);
	}
	const analytics = output as unknown as runAnalyticsSql.Output & { label?: string };
	const title = analytics.label ?? analytics.purpose ?? '';
	if (segment.kind === 'chart' && analytics.chart) {
		return figure(analytics.chart.title ?? title, analyticsChartSvg(analytics, analytics.chart));
	}
	return `<section><h2>${escapeHtml(title)}</h2>${table(analytics.columns, analytics.rows)}</section>`;
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
