import { resolveDataKey } from '@quarry/shared';
import { ChartNoAxesColumn, Rows2, TableIcon, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ChartDisplay } from './display-chart';
import { TableDisplay } from './display-table';
import styles from './chart-editor-preview.module.css';
import type { ReactNode } from 'react';
import type { ChartType } from '@quarry/shared/chart-types';
import type { displayChart } from '@quarry/shared/tools';
import type { IconSegmentedToggleOption } from '@/components/ui/icon-segmented-toggle';
import type { ChartSelectionSummary } from '@/lib/chart-selection-summary';

import { IconSegmentedToggle } from '@/components/ui/icon-segmented-toggle';
import { ResizablePanel, ResizablePanelGroup, ResizableSeparator } from '@/components/ui/resizable';
import { sortByDateKey } from '@/lib/charts.utils';
import { cn } from '@/lib/utils';

type EditableChartInput = Omit<displayChart.KpiCardInput, 'chart_type'> & { chart_type: ChartType };

type PreviewMode = 'chart' | 'table' | 'split';

const PREVIEW_MODE_OPTIONS: IconSegmentedToggleOption<PreviewMode>[] = [
	{ value: 'chart', label: 'Chart', icon: ChartNoAxesColumn },
	{ value: 'table', label: 'Table', icon: TableIcon },
	{ value: 'split', label: 'Chart and table', icon: Rows2 },
];

const X_AXIS_HIGHLIGHT = 'color-mix(in srgb, var(--app-muted) 12%, transparent)';
const SERIES_HIGHLIGHT_OPACITY = '15%';
const SPLIT_PANE_MIN_HEIGHT = 160;

interface ChartEditorPreviewProps {
	draft: EditableChartInput;
	data: Record<string, unknown>[];
	columns: string[];
	summary: ChartSelectionSummary;
	className?: string;
}

/** Chart space of the chart editor: the live chart, the source table, or both stacked. */
export function ChartEditorPreview({ draft, data, columns, summary, className }: ChartEditorPreviewProps) {
	const [mode, setMode] = useState<PreviewMode>('chart');
	const chart = <LiveChart draft={draft} data={data} hasSeries={summary.series.length > 0} />;
	const table = <SourceTable data={data} columns={columns} summary={summary} />;

	return (
		<div className={cn(styles.chartEditorPreviewDiv, className)}>
			<div className={styles.chartEditorPreviewDiv2}>
				<ChartSelectionIssues issues={summary.issues} />
				<IconSegmentedToggle
					options={PREVIEW_MODE_OPTIONS}
					value={mode}
					onValueChange={setMode}
					className={styles.chartEditorPreviewIconSegmentedToggle}
				/>
			</div>
			{mode === 'chart' && chart}
			{mode === 'table' && table}
			{mode === 'split' && (
				<ResizablePanelGroup orientation='vertical' className={styles.chartEditorPreviewResizablePanelGroup}>
					<ResizablePanel
						id='chart'
						defaultSize='55%'
						minSize={SPLIT_PANE_MIN_HEIGHT}
						className={styles.chartEditorPreviewResizablePanel}
					>
						{chart}
					</ResizablePanel>
					<ResizableSeparator withHandle />
					<ResizablePanel
						id='table'
						minSize={SPLIT_PANE_MIN_HEIGHT}
						className={styles.chartEditorPreviewResizablePanel}
					>
						{table}
					</ResizablePanel>
				</ResizablePanelGroup>
			)}
		</div>
	);
}

function ChartSelectionIssues({ issues }: { issues: string[] }) {
	if (issues.length === 0) {
		return null;
	}
	return (
		<ul className={styles.chartSelectionIssuesUl} title={issues.join('\n')}>
			{issues.map((issue) => (
				<li key={issue} className={styles.chartSelectionIssuesLi}>
					<TriangleAlert className={styles.chartSelectionIssuesTriangleAlert} />
					<span className={styles.chartSelectionIssuesSpan}>{issue}</span>
				</li>
			))}
		</ul>
	);
}

interface LiveChartProps {
	draft: EditableChartInput;
	data: Record<string, unknown>[];
	hasSeries: boolean;
}

function LiveChart({ draft, data, hasSeries }: LiveChartProps) {
	const chartData = useMemo(
		() =>
			draft.x_axis_type === 'date' && draft.x_axis_key
				? sortByDateKey(data, resolveDataKey(data, draft.x_axis_key))
				: data,
		[data, draft.x_axis_type, draft.x_axis_key],
	);

	if (data.length === 0 || !hasSeries) {
		return (
			<PreviewPlaceholder>
				{data.length === 0 ? 'No data to preview.' : 'Add a series to preview the chart.'}
			</PreviewPlaceholder>
		);
	}

	const isKpi = draft.chart_type === 'kpi_card';
	return (
		<div className={cn(styles.liveChartDiv, isKpi ? styles.liveChartDiv2 : styles.liveChartDiv3)}>
			<ChartDisplay
				data={chartData}
				chartType={draft.chart_type}
				xAxisKey={draft.x_axis_key ?? ''}
				xAxisType={draft.x_axis_type === 'number' ? 'number' : 'category'}
				xAxisLabel={draft.x_axis_label}
				series={draft.series}
				title={draft.title}
				yAxisMin={draft.y_axis_min}
				yAxisMax={draft.y_axis_max}
				yAxisLabel={draft.y_axis_label}
				yAxisRightMin={draft.y_axis_right_min}
				yAxisRightMax={draft.y_axis_right_max}
				yAxisRightLabel={draft.y_axis_right_label}
				showDataLabels={draft.show_data_labels}
				comparisonMode={draft.comparison_mode}
				hideTotal={draft.hide_total}
				normalSize
			/>
		</div>
	);
}

interface SourceTableProps {
	data: Record<string, unknown>[];
	columns: string[];
	summary: ChartSelectionSummary;
}

function SourceTable({ data, columns, summary }: SourceTableProps) {
	const highlightByColumn = useMemo(() => buildColumnHighlights(summary), [summary]);
	const columnBackground = useMemo(
		() => (column: string) => highlightByColumn.get(column.toLowerCase()),
		[highlightByColumn],
	);

	if (data.length === 0) {
		return <PreviewPlaceholder>The query returned no rows.</PreviewPlaceholder>;
	}

	return (
		<TableDisplay
			data={data}
			columns={columns.length > 0 ? columns : Object.keys(data[0] ?? {})}
			cellBackground={columnBackground}
			headerBackground={columnBackground}
			className={`${styles.sourceTableTableDisplay} chart-editor-table`}
			tableContainerClassName={styles.sourceTableTableDisplay2}
			maxRowsBeforePagination={100}
			compactFooter
		/>
	);
}

function buildColumnHighlights(summary: ChartSelectionSummary): Map<string, string> {
	const highlights = new Map<string, string>();
	if (summary.xAxis?.exists) {
		highlights.set(summary.xAxis.column.toLowerCase(), X_AXIS_HIGHLIGHT);
	}
	for (const series of summary.series) {
		const column = series.profile.column.toLowerCase();
		if (series.profile.exists && !highlights.has(column)) {
			highlights.set(column, `color-mix(in srgb, ${series.color} ${SERIES_HIGHLIGHT_OPACITY}, transparent)`);
		}
	}
	return highlights;
}

function PreviewPlaceholder({ children }: { children: ReactNode }) {
	return <div className={styles.previewPlaceholderDiv}>{children}</div>;
}
