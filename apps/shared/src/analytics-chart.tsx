import React from 'react';
import {
	CartesianGrid,
	Funnel,
	FunnelChart,
	LabelList,
	PolarAngleAxis,
	RadialBar,
	RadialBarChart,
	ReferenceArea,
	ReferenceLine,
	Sankey,
	Scatter,
	ScatterChart,
	Tooltip,
	Treemap,
	XAxis,
	YAxis,
	ZAxis,
} from 'recharts';

import { buildChart, DEFAULT_COLORS, labelize } from './chart-builder';
import type { ChartType } from './chart-types';
import type { runAnalyticsSql } from './tools';

type Chart = runAnalyticsSql.ResultChart;
type ChartInput = runAnalyticsSql.ResultChartInput;
type Cell_ = runAnalyticsSql.Cell;
type AnalyticsChartType = runAnalyticsSql.AnalyticsChartType;

/** Types that take exactly one value column. */
const SINGLE_VALUE = new Set<AnalyticsChartType>([
	'scatter',
	'bubble',
	'pie',
	'donut',
	'radial_bar',
	'treemap',
	'funnel',
	'sankey',
]);
/** Types whose x is a number, not a category. */
const NUMERIC_X = new Set<AnalyticsChartType>(['scatter', 'bubble']);
/** Types that draw x and y axes, where thresholds can be drawn. */
const CARTESIAN = new Set<AnalyticsChartType>([
	'bar',
	'stacked_bar',
	'stacked_bar_100',
	'line',
	'area',
	'stacked_area',
	'stacked_area_100',
	'composed',
	'scatter',
	'bubble',
	'horizontal_bar',
	'horizontal_bar_100',
]);

/** Points read on light and dark surfaces alike. */
const SCATTER_COLOR = '#3b82f6';

const TONE_COLORS = { normal: '#16a34a', actionable: '#d97706', critical: '#dc2626' } as const;

const isNumericCell = (value: Cell_) => value === null || typeof value === 'number' || value === '<5';

/**
 * Why a chart can't be drawn from this result, or null when it can: every column it names must be in the result, the
 * value columns (and a scatter's x, a bubble's size) numeric, and each type gets the columns it needs. The server
 * refuses a chart that fails; the card offers only the types that pass.
 */
export function chartProblem(chart: ChartInput, columns: string[], rows: Cell_[][]): string | null {
	const named = [chart.x, ...chart.y, chart.size, chart.target].filter((column): column is string => !!column);
	const missing = named.filter((column) => !columns.includes(column));
	if (missing.length > 0) {
		return `Chart columns ${missing.join(', ')} are not in the result (columns: ${columns.join(', ')}).`;
	}
	const numeric = (column: string) => rows.every((row) => isNumericCell(row[columns.indexOf(column)]));
	if (SINGLE_VALUE.has(chart.type) && chart.y.length !== 1) {
		return `A ${chart.type.replace('_', ' ')} chart takes exactly one y column.`;
	}
	for (const column of chart.y) {
		if (!numeric(column)) {
			return `Chart column ${column} is not numeric; cast it or pick another.`;
		}
	}
	if (NUMERIC_X.has(chart.type) && !numeric(chart.x)) {
		return `A ${chart.type} chart needs a numeric x; ${chart.x} is not.`;
	}
	if (chart.type === 'bubble' && (!chart.size || !numeric(chart.size))) {
		return 'A bubble chart needs a numeric size column.';
	}
	if (chart.type === 'sankey' && !chart.target) {
		return 'A sankey chart needs a target column (x is the source).';
	}
	if (chart.type === 'composed') {
		const extra = Object.keys(chart.series ?? {}).filter((column) => !chart.y.includes(column));
		if (extra.length > 0) {
			return `composed series ${extra.join(', ')} are not among the y columns.`;
		}
	}
	if (chart.thresholds?.length && !CARTESIAN.has(chart.type)) {
		return `Thresholds are drawn on charts with axes, not on a ${chart.type.replace('_', ' ')} chart.`;
	}
	return null;
}

/** The types a result can be switched to, keeping its columns (the card's chart-type menu). */
export function compatibleChartTypes(chart: Chart, columns: string[], rows: Cell_[][]): AnalyticsChartType[] {
	const types: AnalyticsChartType[] = [];
	for (const type of [
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
	] as const) {
		const candidate = retype(chart, type);
		if (
			!chartProblem(
				{ ...candidate, thresholds: CARTESIAN.has(type) ? candidate.thresholds : undefined },
				columns,
				rows,
			)
		) {
			types.push(type);
		}
	}
	return types;
}

/** The chart as another type, with what that type needs carried over or dropped. */
export function retype(chart: Chart, type: AnalyticsChartType): Chart {
	const next: Chart = { ...chart, type };
	if (SINGLE_VALUE.has(type)) {
		next.y = chart.y.slice(0, 1);
	}
	if (!CARTESIAN.has(type)) {
		next.references = undefined;
		next.thresholds = undefined;
	}
	return next;
}

/** A row per result row, keyed by column, values as the chart draws them ("<5" and text values left out). */
function chartRows(chart: Chart, columns: string[], rows: Cell_[][]) {
	const keep = [chart.x, ...chart.y, chart.size, chart.target].filter((column): column is string => !!column);
	return rows.map((row) =>
		Object.fromEntries(
			keep.map((column) => {
				const value = row[columns.indexOf(column)];
				const isLabel = (column === chart.x && !NUMERIC_X.has(chart.type)) || column === chart.target;
				return [column, isLabel ? String(value ?? '—') : typeof value === 'number' ? value : null];
			}),
		),
	);
}

export interface AnalyticsChartOptions {
	colorFor?: (key: string, index: number) => string;
	/** Extra children for charts with axes (the frontend's tooltip). */
	children?: React.ReactNode[];
	width?: number;
	height?: number;
}

const color = (index: number) => DEFAULT_COLORS[index % DEFAULT_COLORS.length];

/**
 * An analytics result as a Recharts element, in the chat, the report panel and the PDF alike: the shared quarry
 * builder for its chart types, Recharts directly for bubble, radial bar, treemap, funnel and Sankey, and the
 * server-resolved thresholds as reference lines and bands.
 */
export function buildAnalyticsChart(
	chart: Chart,
	columns: string[],
	rows: Cell_[][],
	options: AnalyticsChartOptions = {},
): React.ReactElement {
	const data = chartRows(chart, columns, rows);
	const colorFor = options.colorFor ?? ((_key: string, index: number) => color(index));
	const references = (chart.references ?? []).map((reference, index) => referenceElement(reference, index));
	const children = [...references, ...(options.children ?? [])];
	const margin = { top: 10, right: 24, bottom: 5, left: 0 };
	const size = { ...(options.width && { width: options.width }), ...(options.height && { height: options.height }) };

	switch (chart.type) {
		case 'bubble':
		case 'scatter':
			return (
				<ScatterChart margin={margin} {...size}>
					<CartesianGrid strokeDasharray='3 3' />
					<XAxis
						type='number'
						dataKey={chart.x}
						name={labelize(chart.x)}
						domain={['auto', 'auto']}
						tick={{ fontSize: 12 }}
					/>
					<YAxis
						type='number'
						dataKey={chart.y[0]}
						name={labelize(chart.y[0])}
						domain={['auto', 'auto']}
						tick={{ fontSize: 12 }}
					/>
					{chart.type === 'bubble' && chart.size && (
						<ZAxis type='number' dataKey={chart.size} range={[60, 600]} name={labelize(chart.size)} />
					)}
					<Scatter data={data} fill={SCATTER_COLOR} fillOpacity={0.8} isAnimationActive={false} />
					{children}
				</ScatterChart>
			);
		case 'radial_bar':
			return (
				<RadialBarChart
					data={data.map((row, index) => ({ ...row, fill: colorFor(String(row[chart.x]), index) }))}
					innerRadius='20%'
					outerRadius='95%'
					startAngle={90}
					endAngle={-270}
					{...size}
				>
					<PolarAngleAxis type='number' tick={false} />
					<RadialBar
						dataKey={chart.y[0]}
						background
						label={{ position: 'insideStart', fill: '#fff', fontSize: 11 }}
						isAnimationActive={false}
					/>
					{options.children}
				</RadialBarChart>
			);
		case 'treemap':
			return (
				<Treemap
					data={data.map((row, index) => ({
						name: String(row[chart.x]),
						size: Number(row[chart.y[0]] ?? 0),
						fill: colorFor(String(row[chart.x]), index),
					}))}
					dataKey='size'
					nameKey='name'
					stroke='#fff'
					isAnimationActive={false}
					{...size}
				>
					{options.children}
				</Treemap>
			);
		case 'funnel':
			return (
				<FunnelChart margin={margin} {...size}>
					<Funnel
						data={data.map((row, index) => ({
							name: String(row[chart.x]),
							value: Number(row[chart.y[0]] ?? 0),
							fill: colorFor(String(row[chart.x]), index),
						}))}
						dataKey='value'
						nameKey='name'
						isAnimationActive={false}
					>
						<LabelList position='right' dataKey='name' fill='currentColor' stroke='none' fontSize={12} />
						<LabelList position='center' dataKey='value' fill='#fff' stroke='none' fontSize={12} />
					</Funnel>
					{options.children}
				</FunnelChart>
			);
		case 'sankey': {
			const names = [...new Set(data.flatMap((row) => [String(row[chart.x]), String(row[chart.target!])]))];
			const links = data
				.map((row) => ({
					source: names.indexOf(String(row[chart.x])),
					target: names.indexOf(String(row[chart.target!])),
					value: Number(row[chart.y[0]] ?? 0),
				}))
				.filter((link) => link.value > 0 && link.source !== link.target);
			return (
				<Sankey
					data={{ nodes: names.map((name) => ({ name })), links }}
					nodePadding={24}
					margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
					link={{ stroke: color(0), strokeOpacity: 0.25 }}
					node={{ fill: color(0) }}
					{...size}
				>
					{options.children ? <Tooltip /> : null}
				</Sankey>
			);
		}
		default: {
			const builtin: ChartType = chart.type === 'composed' ? 'mixed' : chart.type;
			const element = buildChart({
				data,
				chartType: builtin,
				xAxisKey: chart.x,
				xAxisType: 'category',
				series: chart.y.map((column, index) => ({
					data_key: column,
					label: labelize(column),
					color: colorFor(column, index),
					...(chart.type === 'composed' && {
						series_type: chart.series?.[column]?.as ?? (index === 0 ? 'bar' : 'line'),
						y_axis: chart.series?.[column]?.axis ?? 'left',
					}),
				})),
				colorFor,
				showGrid: true,
				margin,
				children,
			});
			return Object.keys(size).length > 0 ? React.cloneElement(element, size) : element;
		}
	}
}

function referenceElement(reference: runAnalyticsSql.ChartReference, index: number): React.ReactNode {
	const stroke = TONE_COLORS[reference.tone ?? 'actionable'];
	const axis = reference.axis === 'x' ? { x: reference.value } : { y: reference.value };
	if (reference.value !== undefined) {
		return (
			<ReferenceLine
				key={`ref-${index}`}
				{...axis}
				stroke={stroke}
				strokeDasharray='5 4'
				label={{ value: reference.label, position: 'insideTopRight', fontSize: 11, fill: stroke }}
				ifOverflow='extendDomain'
			/>
		);
	}
	const band =
		reference.axis === 'x' ? { x1: reference.from, x2: reference.to } : { y1: reference.from, y2: reference.to };
	return <ReferenceArea key={`ref-${index}`} {...band} fill={stroke} fillOpacity={0.07} ifOverflow='hidden' />;
}
