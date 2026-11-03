import { BarChart3, Database } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { buildAnalyticsChart, compatibleChartTypes, retype } from '@quarry/shared/analytics-chart';
import { TableDisplay } from './display-table';
import styles from './analytics-result.module.css';
import { SqlQueryDisplay } from './sql-query-display';
import type { runAnalyticsSql } from '@quarry/shared/tools';
import type { ToolCallComponentProps } from '.';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';

const PAGE_SIZE = 10;

/**
 * Wise's `run_analytics_sql` and `get_metric` (DESIGN.md §9.2): the result table of a query run as the user, and the
 * query itself on request, so every number can be traced to its SQL.
 */
export const AnalyticsResultToolCall = memo(
	({ toolPart }: ToolCallComponentProps<'run_analytics_sql'> | ToolCallComponentProps<'get_metric'>) => {
		if (toolPart.state === 'output-error') {
			return <ErrorMessage message={toolPart.errorText} />;
		}
		if (toolPart.state !== 'output-available' || !toolPart.output) {
			return null;
		}
		const { output } = toolPart;
		return 'metric' in output ? (
			<AnalyticsResultCard
				icon='metric'
				title={output.label}
				meta={`Certified metric${output.months ? ` · last ${output.months} months` : ''}`}
				{...output}
			/>
		) : (
			<AnalyticsResultCard
				icon='query'
				title={output.purpose}
				meta={`${output.rowCount} row${output.rowCount === 1 ? '' : 's'}${output.truncated ? ` (first ${output.rowCount})` : ''}`}
				{...output}
			/>
		);
	},
);

function AnalyticsResultCard({
	icon,
	title,
	meta,
	definition,
	sql,
	columns,
	rows,
	suppressed,
	chart,
}: {
	icon: 'metric' | 'query';
	title: string;
	meta: string;
	definition?: string;
	sql: string;
	columns: string[];
	rows: runAnalyticsSql.Cell[][];
	suppressed: boolean;
	chart?: runAnalyticsSql.ResultChart | null;
}) {
	const [showQuery, setShowQuery] = useState(false);
	const [view, setView] = useState<'chart' | 'table'>(chart ? 'chart' : 'table');
	// The clinician may redraw the same result as another type that fits its columns; nothing is re-queried.
	const types = useMemo(() => (chart ? compatibleChartTypes(chart, columns, rows) : []), [chart, columns, rows]);
	const [type, setType] = useState(chart?.type);
	const shownChart = chart && type && type !== chart.type ? retype(chart, type) : chart;
	// Columns by position: a query may repeat a name, which would collapse two columns into one in an object row.
	const keys = useMemo(() => columns.map((column, index) => `${index}:${column}`), [columns]);
	const data = useMemo(
		() => rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index]]))),
		[rows, keys],
	);
	const Icon = icon === 'metric' ? BarChart3 : Database;
	return (
		<div className={styles.card} data-testid='analytics-result'>
			<div className={styles.header}>
				<Icon />
				<span className={styles.title}>{title}</span>
				<span className={styles.meta}>{meta}</span>
				{chart && view === 'chart' && types.length > 1 && (
					<select
						className={styles.typeSelect}
						aria-label='Chart type'
						value={type}
						onChange={(event) => setType(event.target.value as runAnalyticsSql.AnalyticsChartType)}
						data-testid='chart-type'
					>
						{types.map((option) => (
							<option key={option} value={option}>
								{option.replaceAll('_', ' ')}
							</option>
						))}
					</select>
				)}
				{chart && (
					<Button
						variant='ghost-muted'
						size='sm'
						className={view === 'chart' && types.length > 1 ? undefined : styles.toggle}
						onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
					>
						{view === 'chart' ? 'Table' : 'Chart'}
					</Button>
				)}
				<Button
					variant='ghost-muted'
					size='sm'
					className={chart ? undefined : styles.toggle}
					onClick={() => setShowQuery(!showQuery)}
				>
					{showQuery ? 'Hide query' : 'View query'}
				</Button>
			</div>
			{definition && <p className={styles.definition}>{definition}</p>}
			{showQuery && <SqlQueryDisplay query={sql} />}
			{chart && view === 'chart' ? (
				<ResultChartView chart={shownChart ?? chart} columns={columns} rows={rows} />
			) : (
				<TableDisplay
					data={data}
					columns={keys}
					columnLabels={Object.fromEntries(keys.map((key, index) => [key, columns[index]]))}
					maxRowsBeforePagination={PAGE_SIZE}
					compactFooter
				/>
			)}
			{suppressed && <span className={styles.note}>Counts under 5 are shown as “&lt;5” to protect privacy.</span>}
		</div>
	);
}

/**
 * The result drawn by the shared analytics chart builder (every Recharts type the server accepts), from its own
 * columns, with the thresholds the server resolved; "<5" cells are left out of the plot.
 */
export function ResultChartView({
	chart,
	columns,
	rows,
}: {
	chart: runAnalyticsSql.ResultChart;
	columns: string[];
	rows: runAnalyticsSql.Cell[][];
}) {
	const element = useMemo(
		() =>
			buildAnalyticsChart(chart, columns, rows, {
				children: [<Tooltip key='tooltip' />, ...(LEGENDLESS.has(chart.type) ? [] : [<Legend key='legend' />])],
			}),
		[chart, columns, rows],
	);
	return (
		<div className={styles.chart} data-testid='analytics-chart' data-chart-type={chart.type}>
			{chart.title && <div className={styles.chartTitle}>{chart.title}</div>}
			<ResponsiveContainer width='100%' height={chart.type === 'sankey' ? 320 : 260}>
				{element}
			</ResponsiveContainer>
		</div>
	);
}

/** Charts that label their own parts. */
const LEGENDLESS = new Set(['treemap', 'funnel', 'sankey', 'scatter', 'bubble']);

/** A result's rows as a paged table, columns by position (a query may repeat a column name). */
export function ResultTable({ columns, rows }: { columns: string[]; rows: runAnalyticsSql.Cell[][] }) {
	const keys = useMemo(() => columns.map((column, index) => `${index}:${column}`), [columns]);
	const data = useMemo(
		() => rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index]]))),
		[rows, keys],
	);
	return (
		<TableDisplay
			data={data}
			columns={keys}
			columnLabels={Object.fromEntries(keys.map((key, index) => [key, columns[index]]))}
			maxRowsBeforePagination={PAGE_SIZE}
			compactFooter
		/>
	);
}
