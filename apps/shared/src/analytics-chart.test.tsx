import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildAnalyticsChart, chartProblem, compatibleChartTypes, retype } from './analytics-chart';
import type { runAnalyticsSql } from './tools';

type Chart = runAnalyticsSql.ResultChart;

const columns = ['band', 'patients', 'visits', 'hba1c', 'bmi', 'target', 'label'];
const rows: runAnalyticsSql.Cell[][] = [
	['40-59', 4, 9, 7.2, 30, 'Referred', 'a'],
	['60+', 3, 5, 6.1, 27.4, 'Treated', 'b'],
	['18-39', '<5', 2, 5.6, 24, 'Referred', 'c'],
];

/** One valid chart per type, over the same result. */
const CHARTS: Record<runAnalyticsSql.AnalyticsChartType, Chart> = {
	bar: { type: 'bar', x: 'band', y: ['patients', 'visits'] },
	stacked_bar: { type: 'stacked_bar', x: 'band', y: ['patients', 'visits'] },
	stacked_bar_100: { type: 'stacked_bar_100', x: 'band', y: ['patients', 'visits'] },
	horizontal_bar: { type: 'horizontal_bar', x: 'band', y: ['patients'] },
	horizontal_bar_100: { type: 'horizontal_bar_100', x: 'band', y: ['patients', 'visits'] },
	line: { type: 'line', x: 'band', y: ['hba1c'], references: [{ label: 'HbA1c 6.5', axis: 'y', value: 6.5 }] },
	area: { type: 'area', x: 'band', y: ['visits'] },
	stacked_area: { type: 'stacked_area', x: 'band', y: ['patients', 'visits'] },
	stacked_area_100: { type: 'stacked_area_100', x: 'band', y: ['patients', 'visits'] },
	composed: {
		type: 'composed',
		x: 'band',
		y: ['visits', 'hba1c'],
		series: { visits: { as: 'bar' }, hba1c: { as: 'line', axis: 'right' } },
	},
	scatter: {
		type: 'scatter',
		x: 'bmi',
		y: ['hba1c'],
		references: [{ label: 'Diabetes range', axis: 'y', from: 6.5, tone: 'actionable' }],
	},
	bubble: { type: 'bubble', x: 'bmi', y: ['hba1c'], size: 'visits' },
	pie: { type: 'pie', x: 'band', y: ['visits'] },
	donut: { type: 'donut', x: 'band', y: ['visits'] },
	radar: { type: 'radar', x: 'band', y: ['patients', 'visits'] },
	radial_bar: { type: 'radial_bar', x: 'band', y: ['visits'] },
	treemap: { type: 'treemap', x: 'band', y: ['visits'] },
	funnel: { type: 'funnel', x: 'band', y: ['visits'] },
	sankey: { type: 'sankey', x: 'band', target: 'target', y: ['visits'] },
};

describe('analytics charts', () => {
	it.each(Object.values(CHARTS))('accepts and draws a $type chart from the result', (chart) => {
		expect(chartProblem(chart, columns, rows)).toBeNull();
		const svg = renderToStaticMarkup(buildAnalyticsChart(chart, columns, rows, { width: 600, height: 300 }));
		expect(svg).toContain('<svg');
		expect(svg).not.toMatch(/NaN/);
	});

	it.each([
		[{ type: 'bar', x: 'band', y: ['made_up'] }, /Chart columns made_up are not in the result/],
		[{ type: 'line', x: 'band', y: ['label'] }, /label is not numeric/],
		[{ type: 'pie', x: 'band', y: ['patients', 'visits'] }, /exactly one y column/],
		[{ type: 'scatter', x: 'band', y: ['hba1c'] }, /needs a numeric x/],
		[{ type: 'bubble', x: 'bmi', y: ['hba1c'] }, /needs a numeric size column/],
		[{ type: 'sankey', x: 'band', y: ['visits'] }, /needs a target column/],
		[{ type: 'composed', x: 'band', y: ['visits'], series: { hba1c: { as: 'line' } } }, /not among the y columns/],
		[
			{ type: 'funnel', x: 'band', y: ['visits'], thresholds: ['4548-4'] },
			/Thresholds are drawn on charts with axes/,
		],
	] as [Chart, RegExp][])('refuses %o', (chart, message) => {
		expect(chartProblem(chart, columns, rows)).toMatch(message);
	});

	it('offers the types a result can switch to, keeping its columns', () => {
		const types = compatibleChartTypes(CHARTS.bar, columns, rows);
		expect(types).toEqual(expect.arrayContaining(['bar', 'line', 'pie', 'radar', 'funnel', 'treemap']));
		expect(types).not.toContain('scatter');
		expect(types).not.toContain('sankey');
		expect(retype(CHARTS.line, 'pie')).toMatchObject({ type: 'pie', y: ['hba1c'], references: undefined });
	});
});
