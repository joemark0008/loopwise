import { clinicalChart, createReport } from '@quarry/shared/tools';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { renderChartToSvg } from '../../../charts/components/generate-chart.js';

const CHART_WIDTH = 680;
const CHART_HEIGHT = 260;

/** A report as one static HTML page (no scripts, no external requests), printed to PDF by headless Chrome. */
export function renderReportHtml(output: createReport.Output): string {
	const { snapshot, narrative } = output;
	const body = renderToStaticMarkup(
		<main>
			<div className='watermark'>{createReport.WATERMARK}</div>
			<header>
				<div className='brand'>Loopwise</div>
				<h1>{snapshot.title}</h1>
				<p className='subject'>{snapshot.subject}</p>
				<p className='meta'>
					Generated {formatDateTime(snapshot.generatedAt)} by {snapshot.generatedBy}
					{snapshot.type === 'encounter_summary' ? '' : ` · period: last ${snapshot.months} months`}
					{snapshot.facility ? ` · ${snapshot.facility.name}` : ''}
				</p>
			</header>
			<section className='narrative'>
				<h2>Wise summary — AI draft, verify against the data below</h2>
				<p>{narrative}</p>
			</section>
			{snapshot.sections.map((section, index) => (
				<SectionBlock key={index} section={section} />
			))}
		</main>,
	);
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.title)}</title><style>${STYLES}</style></head><body>${body}</body></html>`;
}

export function SectionBlock({ section }: { section: createReport.Section }) {
	switch (section.kind) {
		case 'facts':
			return (
				<section>
					<h2>{section.title}</h2>
					<dl>
						{section.facts.map((fact) => (
							<div key={fact.label} className='fact'>
								<dt>{fact.label}</dt>
								<dd>{fact.value}</dd>
							</div>
						))}
					</dl>
				</section>
			);
		case 'table':
			return (
				<section>
					<h2>{section.title}</h2>
					{section.rows.length === 0 ? (
						<p className='empty'>{section.empty}</p>
					) : (
						<table>
							<thead>
								<tr>
									{section.columns.map((column) => (
										<th key={column}>{column}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{section.rows.map((row, rowIndex) => (
									<tr key={rowIndex}>
										{row.map((cell, cellIndex) => (
											<td key={cellIndex}>{cell}</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>
			);
		case 'chart':
			return (
				<section className='chart'>
					<h2>{section.title}</h2>
					{section.chart.rows.length === 0 ? (
						<p className='empty'>No data in this period.</p>
					) : (
						<div dangerouslySetInnerHTML={{ __html: chartSvg(section.chart) }} />
					)}
				</section>
			);
		case 'text':
			return (
				<section>
					<h2>{section.title}</h2>
					<p className='text'>{section.text}</p>
				</section>
			);
	}
}

/** The chart as server-drawn SVG, from the same `buildChart` the chat card uses. */
export function chartSvg(chart: clinicalChart.ChartSpec): string {
	return renderChartToSvg({
		config: {
			chart_type: chart.chartType,
			x_axis_key: chart.xAxisKey,
			x_axis_type: 'category',
			series: chart.series,
			y_axis_label: chart.yAxisLabel,
			y_axis_right_label: chart.yAxisRightLabel,
			title: '',
		},
		data: chart.rows,
		width: CHART_WIDTH,
		height: CHART_HEIGHT,
		margin: { top: 10, right: 36, bottom: 5, left: 0 },
	});
}

/** The page footer Chrome prints on every page (its own template, styled inline). */
export function reportFooterTemplate(output: createReport.Output): string {
	const { snapshot } = output;
	return footerTemplate({
		subject: snapshot.subject,
		generatedAt: snapshot.generatedAt,
		generatedBy: snapshot.generatedBy,
	});
}

/** The page footer Chrome prints on every page (its own template, styled inline). */
export function footerTemplate(report: { subject: string; generatedAt: string; generatedBy: string }): string {
	return `<div style="width:100%;font-size:7.5px;color:#64748b;padding:0 14mm;display:flex;justify-content:space-between;font-family:Inter,system-ui,sans-serif">
<span>Loopwise · ${escapeHtml(report.subject)} · generated ${escapeHtml(formatDateTime(report.generatedAt))} by ${escapeHtml(report.generatedBy)} · ${escapeHtml(createReport.WATERMARK)} · AI-drafted narrative, verify before clinical use</span>
<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

export const formatDateTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export const STYLES = `
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 10pt; color: #0f172a; }
h1 { font-family: Manrope, Inter, system-ui, sans-serif; font-size: 17pt; font-weight: 800; margin: 2pt 0; }
h2 { font-family: Manrope, Inter, system-ui, sans-serif; font-size: 11pt; font-weight: 700; margin: 0 0 5pt; }
header { border-bottom: 1.5pt solid #0f172a; padding-bottom: 6pt; margin-bottom: 10pt; }
.brand { font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; }
.subject { font-size: 11pt; font-weight: 600; margin: 0; }
.meta { font-size: 8pt; color: #64748b; margin: 3pt 0 0; }
section { margin: 0 0 11pt; break-inside: avoid; }
.narrative { border: 1pt solid #cbd5e1; border-left: 3pt solid #2563eb; background: #f8fafc; padding: 7pt 9pt; }
.narrative h2 { font-size: 8.5pt; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }
.narrative p { margin: 0; line-height: 1.45; }
dl { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 14pt; margin: 0; }
.fact { display: flex; gap: 6pt; }
dt { color: #64748b; min-width: 82pt; }
dd { margin: 0; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { text-align: left; font-size: 8pt; color: #475569; border-bottom: 1pt solid #94a3b8; padding: 2pt 4pt; }
td { border-bottom: 0.5pt solid #e2e8f0; padding: 2.5pt 4pt; vertical-align: top; }
td:first-child { white-space: nowrap; }
tr { break-inside: avoid; }
.empty { color: #64748b; font-style: italic; margin: 0; }
.chart svg { display: block; max-width: 100%; height: auto; }
.text { white-space: pre-wrap; margin: 0; }
.watermark { position: fixed; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 30pt;
  font-weight: 800; color: rgba(220, 38, 38, 0.11); white-space: nowrap; pointer-events: none; z-index: 10;
  text-transform: uppercase; letter-spacing: 0.04em; }
`;
