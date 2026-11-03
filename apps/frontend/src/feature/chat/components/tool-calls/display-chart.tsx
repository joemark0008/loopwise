import { bucketPieData, buildChart, labelize, resolveDataKey, useChartStyle } from '@quarry/shared';
import {
	buildSeriesChartConfig,
	buildSeriesLegendPayload,
	seriesColorAt,
	useSeriesVisibility,
} from '@quarry/shared/chart-series';
import { isBuiltinChartType, isComboChart, isPercentStackedChartType, isPieChart } from '@quarry/shared/chart-types';
import { displayChart } from '@quarry/shared/tools';
import { useQueryClient } from '@tanstack/react-query';
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Code, Download, Pencil, Table as TableIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Customized } from 'recharts';
import { DisplayChartEditDialog } from './display-chart-edit-dialog';
import { DisplayChartTable } from './display-chart-table';
import { ChartRangeSelector } from './display-chart-range-selector';
import { CustomChart } from './custom-chart';
import { SqlQueryDisplay } from './sql-query-display';
import { SqlResultDisplay } from './sql-result-display';
import { VisualizationSkeleton } from './visualization-skeleton';
import { ToolCallWrapper } from './tool-call-wrapper';
import styles from './display-chart.module.css';
import type { ChartConfig } from '@quarry/shared/chart-tooltip';
import type { ChartType } from '@quarry/shared/chart-types';
import type { ToolCallComponentProps } from '.';
import type { DateRange } from '@/lib/charts.utils';
import { useOptionalAgentContext } from '@/contexts/agent.provider.tsx';
import { Button } from '@/components/ui/button';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';
import { chartsApi } from '@/lib/charts-api';
import {
	DATE_RANGE_OPTIONS,
	filterByDateRange,
	resolvePieTooltipLabel,
	sortByDateKey,
	toKey,
} from '@/lib/charts.utils';
import { useDateFormat } from '@/hooks/use-date-format';
import { useResizeObserver } from '@/hooks/use-resize-observer';
import { useToolCallContext } from '@/contexts/tool-call';
import { cn } from '@/lib/utils';
import { ExportDataMenu } from '@/components/export-data-menu';
import { useSourceQuery } from '@/hooks/use-source-query';

const LEGEND_SCROLL_OFFSET = 120;
const HORIZONTAL_LABEL_GAP = 12;
const DIAGONAL_LABEL_GAP = 8;
const CHAR_WIDTH_RATIO = 0.6;
const ANGLE_COS = Math.cos((35 * Math.PI) / 180);
const ANGLE_SIN = Math.sin((35 * Math.PI) / 180);
const MIN_TICK_FONT = 9;
const MAX_TICK_FONT = 12;
const MAX_TICK_LABEL_HEIGHT = 44;

type ViewMode = 'chart' | 'data' | 'query';

export const DisplayChartToolCall = ({ toolPart }: ToolCallComponentProps<'display_chart'>) => {
	const { state, input, output, toolCallId } = toolPart;
	const agent = useOptionalAgentContext();
	const queryClient = useQueryClient();
	const { isSettled } = useToolCallContext();
	const config = state !== 'input-streaming' ? input : undefined;
	const chartConfig = config && displayChart.isChartInput(config) ? config : undefined;
	const tableConfig = config && displayChart.isTableInput(config) ? config : undefined;
	const isTableVariant = input?.chart_type === 'table';
	const isBuiltinChart = chartConfig ? isBuiltinChartType(chartConfig.chart_type) : false;
	const [dataRange, setDataRange] = useState<DateRange>('all');
	const [viewMode, setViewMode] = useState<ViewMode>('chart');
	const normalSize = useMemo(() => (document.querySelector('[data-selection-container]') ? true : false), []);

	const [isDownloading, setIsDownloading] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const isEditable = Boolean(agent && !agent.isReadonly && !agent.isRunning && isBuiltinChart);

	const { sourceQuery, sourceData, isLoadingRows } = useSourceQuery(chartConfig?.query_id);
	const sqlQuery = sourceQuery?.input?.sql_query;

	const handleDownloadPng = async () => {
		if (!chartConfig) {
			return;
		}

		setIsDownloading(true);
		try {
			const image = await queryClient.fetchQuery(chartsApi.chart.download.queryOptions({ toolCallId }));
			const link = document.createElement('a');
			link.download = `${chartConfig.title || 'chart'}.png`;
			link.href = `data:image/png;base64,${image}`;
			link.click();
		} catch (err) {
			console.error('Error downloading chart image:', err);
		} finally {
			setIsDownloading(false);
		}
	};

	const filteredData = useMemo(() => {
		if (!sourceData?.data || !chartConfig) {
			return [];
		}
		if (chartConfig.x_axis_type !== 'date') {
			return sourceData.data;
		}
		const xAxisKey = resolveDataKey(sourceData.data, chartConfig.x_axis_key);
		const sorted = sortByDateKey(sourceData.data, xAxisKey);
		return filterByDateRange(sorted, xAxisKey, dataRange);
	}, [sourceData?.data, chartConfig, dataRange]);
	const customChartConfig = useMemo(
		() =>
			chartConfig
				? {
						...chartConfig,
						x_axis_key: chartConfig.x_axis_key ?? '',
						x_axis_type: chartConfig.x_axis_type ?? null,
					}
				: undefined,
		[chartConfig],
	);

	if (isTableVariant) {
		return <DisplayChartTable config={tableConfig} outputError={output?.error} toolCallId={toolCallId} />;
	}

	if (output && output.error) {
		return (
			<ToolCallWrapper defaultExpanded title='Could not display the chart'>
				<div className={styles.displayChartToolCallDiv}>{output.error}</div>
			</ToolCallWrapper>
		);
	}

	if (!chartConfig || !customChartConfig) {
		// Only show the loader while the input is genuinely still streaming. An
		// orphaned partial tool call stuck in `input-streaming` after the message
		// settled would otherwise render an endless loader.
		if (state !== 'input-streaming' || isSettled) {
			return null;
		}
		return <VisualizationSkeleton label='Loading chart' />;
	}

	if (chartConfig.series.length === 0) {
		return (
			<div className={styles.displayChartToolCallDiv2}>
				Could not display the chart because no series are configured.
			</div>
		);
	}

	if (isLoadingRows) {
		return <VisualizationSkeleton label='Loading chart data' />;
	}

	if (!sourceData) {
		return (
			<div className={styles.displayChartToolCallDiv2}>
				Could not display the chart because the data is missing.
			</div>
		);
	}

	if (!sourceData.data || sourceData.data.length === 0) {
		return (
			<div className={styles.displayChartToolCallDiv2}>
				Could not display the chart because the data is empty.
			</div>
		);
	}

	const isKpiChartView = viewMode === 'chart' && chartConfig.chart_type === 'kpi_card';
	const isPieChartView = viewMode === 'chart' && isPieChart(chartConfig.chart_type);

	return (
		<div
			className={cn(
				`${styles.displayChartToolCallDiv3} group/chart`,
				`${styles.displayChartToolCallDiv4} bg-backgroundSecondary/30`,
				viewMode === 'chart' ? styles.displayChartToolCallDiv5 : styles.displayChartToolCallDiv6,
				viewMode === 'chart' ? styles.displayChartToolCallDiv7 : styles.displayChartToolCallDiv8,
				isKpiChartView ? styles.displayChartToolCallDiv9 : '',
				viewMode === 'chart' && chartConfig.chart_type !== 'kpi_card' && !normalSize
					? styles.displayChartToolCallDiv10
					: '',
			)}
		>
			<div
				className={cn(
					styles.displayChartToolCallDiv11,
					isKpiChartView
						? styles.displayChartToolCallDiv12
						: isPieChartView
							? styles.displayChartToolCallDiv13
							: styles.displayChartToolCallDiv14,
					!isKpiChartView &&
						!isPieChartView &&
						(viewMode === 'chart' ? styles.displayChartToolCallDiv15 : styles.displayChartToolCallDiv16),
				)}
			>
				{chartConfig.chart_type != 'kpi_card' ? (
					<div className={styles.displayChartToolCallDiv17}>
						<span className={`${styles.displayChartToolCallSpan} quarry-chart-title`}>
							{chartConfig.title}
						</span>
						{viewMode === 'chart' &&
							!isPieChart(chartConfig.chart_type) &&
							chartConfig.x_axis_type === 'date' && (
								<ChartRangeSelector
									options={DATE_RANGE_OPTIONS}
									selectedRange={dataRange}
									onRangeSelected={(range) => setDataRange(range)}
								/>
							)}
					</div>
				) : (
					<div></div>
				)}
				<div className={styles.displayChartToolCallDiv18}>
					<div className={styles.displayChartToolCallDiv19}>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className={cn(
								styles.displayChartToolCallButton,
								viewMode === 'chart' ? styles.displayChartToolCallButton2 : '',
							)}
							onClick={() => setViewMode('chart')}
							title='View chart'
						>
							<ChartNoAxesColumn
								className={styles.displayChartToolCallChartNoAxesColumn}
								strokeWidth={2.25}
							/>
						</Button>
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className={cn(
								styles.displayChartToolCallButton,
								viewMode === 'data' ? styles.displayChartToolCallButton2 : '',
							)}
							onClick={() => setViewMode('data')}
							title='View data'
						>
							<TableIcon className={styles.displayChartToolCallChartNoAxesColumn} strokeWidth={2.25} />
						</Button>
						{sqlQuery && (
							<Button
								variant='ghost-muted'
								size='icon-xs'
								className={cn(
									styles.displayChartToolCallButton,
									viewMode === 'query' ? styles.displayChartToolCallButton2 : '',
								)}
								onClick={() => setViewMode('query')}
								title='View SQL query'
							>
								<Code className={styles.displayChartToolCallChartNoAxesColumn} strokeWidth={2.25} />
							</Button>
						)}

						{viewMode === 'chart' ? (
							isBuiltinChart &&
							chartConfig.chart_type != 'kpi_card' && (
								<Button
									variant='ghost-muted'
									size='icon-xs'
									className={styles.displayChartToolCallButton}
									onClick={handleDownloadPng}
									disabled={isDownloading}
									title='Download as PNG'
								>
									<Download
										className={styles.displayChartToolCallChartNoAxesColumn}
										strokeWidth={2.25}
									/>
								</Button>
							)
						) : (
							<ExportDataMenu
								columns={sourceData.columns}
								data={sourceData.data as Record<string, unknown>[]}
								filename={chartConfig.title || 'chart'}
							>
								<Button
									variant='ghost-muted'
									size='icon-xs'
									className={styles.displayChartToolCallButton}
									title='Export data'
								>
									<Download
										className={styles.displayChartToolCallChartNoAxesColumn}
										strokeWidth={2.25}
									/>
								</Button>
							</ExportDataMenu>
						)}
					</div>
					{isEditable && (
						<Button
							variant='ghost-muted'
							size='icon-xs'
							className={styles.displayChartToolCallButton}
							onClick={() => setIsEditOpen(true)}
							title='Edit chart'
						>
							<Pencil className={styles.displayChartToolCallChartNoAxesColumn} strokeWidth={2.25} />
						</Button>
					)}
				</div>
			</div>

			{isEditable && isBuiltinChartType(chartConfig.chart_type) && (
				<DisplayChartEditDialog
					open={isEditOpen}
					onOpenChange={setIsEditOpen}
					toolCallId={toolCallId}
					config={{ ...chartConfig, chart_type: chartConfig.chart_type }}
					availableColumns={sourceData.columns ?? []}
					data={sourceData.data ?? []}
					sourceQuery={sourceQuery ?? undefined}
				/>
			)}

			{viewMode === 'data' ? (
				<SqlResultDisplay output={sourceData} />
			) : viewMode === 'query' && sqlQuery ? (
				<SqlQueryDisplay query={sqlQuery} />
			) : !isBuiltinChartType(chartConfig.chart_type) ? (
				<CustomChart config={customChartConfig} data={filteredData} />
			) : (
				<ChartDisplay
					data={filteredData}
					chartType={chartConfig.chart_type}
					xAxisKey={chartConfig.x_axis_key ?? ''}
					series={chartConfig.series}
					xAxisType={chartConfig.x_axis_type === 'number' ? 'number' : 'category'}
					xAxisLabel={chartConfig.x_axis_label}
					title={chartConfig.title}
					yAxisMin={chartConfig.y_axis_min}
					yAxisMax={chartConfig.y_axis_max}
					yAxisLabel={chartConfig.y_axis_label}
					yAxisRightMin={chartConfig.y_axis_right_min}
					yAxisRightMax={chartConfig.y_axis_right_max}
					yAxisRightLabel={chartConfig.y_axis_right_label}
					showDataLabels={chartConfig.show_data_labels}
					comparisonMode={'comparison_mode' in chartConfig ? chartConfig.comparison_mode : undefined}
					hideTotal={chartConfig.hide_total}
					className={isPieChart(chartConfig.chart_type) ? styles.displayChartToolCallChartDisplay : undefined}
					chartContentClassName={
						isPieChart(chartConfig.chart_type) ? styles.displayChartToolCallChartDisplay2 : undefined
					}
				/>
			)}
		</div>
	);
};

export interface ChartDisplayProps {
	data: Record<string, unknown>[];
	chartType: ChartType;
	xAxisKey: string;
	xAxisType: 'number' | 'category';
	xAxisLabel?: string;
	xAxisLabelFormatter?: (value: string) => string;
	valueFormatter?: (value: number) => string;
	series: displayChart.SeriesConfig[];
	title?: string;
	titleStyle?: 'default' | 'left';
	titleAccessory?: React.ReactNode;
	showLegend?: boolean;
	showGrid?: boolean;
	yAxisMin?: number;
	yAxisMax?: number;
	yAxisLabel?: string;
	yAxisRightMin?: number;
	yAxisRightMax?: number;
	yAxisRightLabel?: string;
	showDataLabels?: boolean;
	animate?: boolean;
	comparisonMode?: displayChart.ComparisonMode;
	className?: string;
	chartContainerClassName?: string;
	chartContentClassName?: string;
	normalSize?: boolean;
	hideTotal?: boolean;
	kpiLeadingSlot?: React.ReactNode;
	disableTooltip?: boolean;
}

export const ChartDisplay = memo(function ChartDisplay({
	data,
	chartType,
	xAxisKey: xAxisKeyProp,
	xAxisType,
	xAxisLabel,
	xAxisLabelFormatter,
	valueFormatter,
	series: seriesProp,
	title,
	titleStyle = 'default',
	titleAccessory,
	showLegend = true,
	showGrid = true,
	yAxisMin,
	yAxisMax,
	yAxisLabel,
	yAxisRightMin,
	yAxisRightMax,
	yAxisRightLabel,
	showDataLabels,
	animate = false,
	comparisonMode,
	className,
	chartContainerClassName,
	chartContentClassName,
	normalSize = false,
	hideTotal,
	kpiLeadingSlot,
	disableTooltip = false,
}: ChartDisplayProps) {
	const dateFormat = useDateFormat();
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [plotWidth, setPlotWidth] = useState(0);
	useResizeObserver(containerRef, (element) => {
		setWidth(element.getBoundingClientRect().width);
	});
	const gradientIdPrefix = `${useId().replace(/[^a-zA-Z0-9]/g, '')}-`;
	const handlePlotWidthChange = useCallback((nextPlotWidth: number) => {
		setPlotWidth((currentPlotWidth) => (currentPlotWidth === nextPlotWidth ? currentPlotWidth : nextPlotWidth));
	}, []);

	const xAxisKey = useMemo(() => resolveDataKey(data, xAxisKeyProp), [data, xAxisKeyProp]);
	const series = useMemo(
		() => seriesProp.map((s) => ({ ...s, data_key: resolveDataKey(data, s.data_key) })),
		[data, seriesProp],
	);

	const { visibleSeries, hiddenSeriesKeys, handleToggleSeriesVisibility } = useSeriesVisibility(series);
	const isPercentStacked = isPercentStackedChartType(chartType);

	const isPie = isPieChart(chartType);
	const pieCenteringClass = isPie ? styles.pieCenteringClass : '';
	const pieValueKey = series[0]?.data_key ?? '';
	const pieData = useMemo(
		() => (isPie ? bucketPieData(data, xAxisKey, pieValueKey) : data),
		[isPie, data, xAxisKey, pieValueKey],
	);
	const useInlineHeader = titleStyle === 'left' && Boolean(title) && !isPie;
	const showInlineLegend = showLegend && chartType !== 'kpi_card';
	const { scrollRef, canScrollLeft, canScrollRight, scrollLegend } = useHorizontalScrollControls();

	const chartConfig = useMemo((): ChartConfig => {
		if (isPie) {
			return pieData.reduce<ChartConfig>(
				(acc, item, index) => {
					const category = String(item[xAxisKey]);
					acc[toKey(category)] = {
						label: labelize(category, dateFormat),
						color: seriesColorAt(index),
					};
					return acc;
				},
				{
					[xAxisKey]: {
						label: labelize(xAxisKey, dateFormat),
					},
					[pieValueKey]: {
						valueFormat: series[0]?.value_format,
					},
				},
			);
		}

		return buildSeriesChartConfig(series, (dataKey) => labelize(dataKey, dateFormat));
	}, [series, xAxisKey, pieValueKey, pieData, isPie, dateFormat]);

	const colorFor = useMemo(
		() =>
			isPie
				? (value: string, _i: number) => `var(--color-${toKey(value)})`
				: (dataKey: string, _i: number) => `var(--color-${dataKey})`,
		[isPie],
	);

	const legendPayload = useMemo(() => {
		if (isPie) {
			return pieData.map((item, index) => {
				const category = String(item[xAxisKey]);
				return {
					value: category,
					dataKey: toKey(category),
					color: seriesColorAt(index),
					isHidden: false,
				};
			});
		}
		return buildSeriesLegendPayload(series, hiddenSeriesKeys, (dataKey) => labelize(dataKey, dateFormat));
	}, [isPie, pieData, xAxisKey, series, hiddenSeriesKeys, dateFormat]);

	const labelFormatter = useMemo(
		() => xAxisLabelFormatter ?? ((value: string) => labelize(value, dateFormat)),
		[xAxisLabelFormatter, dateFormat],
	);
	const xAxisWidth = plotWidth > 0 ? plotWidth : width;
	const perCategoryPx = xAxisWidth > 0 ? xAxisWidth / Math.max(data.length, 1) : 0;
	const longestLabelLen = Math.max(1, ...data.map((row) => labelFormatter(String(row[xAxisKey])).length));
	// Keep labels horizontal while they fit side by side (label width plus a small gap);
	// only once they would actually collide do we shrink + rotate, and then discard.
	const horizontalLabelPx = longestLabelLen * MAX_TICK_FONT * CHAR_WIDTH_RATIO + HORIZONTAL_LABEL_GAP;
	const compactXAxis = !isPie && xAxisType === 'category' && xAxisWidth > 0 && perCategoryPx < horizontalLabelPx;

	let xAxisTickFontSize: number | undefined;
	let xAxisMaxLabelChars: number | undefined;
	let compactXAxisInterval: number | undefined;
	if (compactXAxis) {
		const neededFont = perCategoryPx / (longestLabelLen * CHAR_WIDTH_RATIO * ANGLE_COS);
		xAxisTickFontSize = Math.round(Math.max(MIN_TICK_FONT, Math.min(MAX_TICK_FONT, neededFont)));

		const charPx = xAxisTickFontSize * CHAR_WIDTH_RATIO;
		// A rotated label can't be taller than the axis band, so cap its length first, then
		// reserve slots from the length we actually draw (not the full label) — otherwise we
		// discard more labels than the space truly needs.
		const verticalCharCap = Math.floor(MAX_TICK_LABEL_HEIGHT / (charPx * ANGLE_SIN));
		if (longestLabelLen > verticalCharCap) {
			xAxisMaxLabelChars = verticalCharCap;
		}
		const drawnLabelLen = Math.min(longestLabelLen, verticalCharCap);
		const labelSlotPx = drawnLabelLen * charPx * ANGLE_COS + DIAGONAL_LABEL_GAP;
		if (perCategoryPx < labelSlotPx) {
			// N labels need only N-1 gaps between them, so credit one gap back before dividing;
			// otherwise a label is discarded a full slot early, before the labels actually touch.
			const maxVisible = Math.max(1, Math.floor((xAxisWidth + DIAGONAL_LABEL_GAP) / labelSlotPx));
			compactXAxisInterval = Math.max(0, Math.ceil(data.length / maxVisible) - 1);
		}
	}

	const tooltipLabelFormatter = useMemo(
		() => (value: unknown, items: unknown) =>
			isPie
				? labelize(resolvePieTooltipLabel(items as { name?: unknown }[]), dateFormat)
				: labelize(value as string, dateFormat),
		[isPie, dateFormat],
	);

	const isDualAxis = isComboChart(chartType) && displayChart.hasRightAxisSeries(visibleSeries);
	const chartStyle = useChartStyle();

	const chartElement = useMemo(
		() =>
			buildChart({
				chartStyle,
				data: pieData,
				chartType,
				xAxisKey,
				xAxisType,
				xAxisLabel,
				series: visibleSeries,
				colorFor,
				labelFormatter,
				valueFormatter,
				compactXAxis,
				compactXAxisInterval,
				xAxisTickFontSize,
				xAxisMaxLabelChars,
				showGrid,
				showDataLabels,
				animate,
				comparisonMode,
				gradientIdPrefix,
				kpiLeadingSlot,
				margin: { top: 0, right: 0, bottom: 0, left: 0 },
				yAxisMin,
				yAxisMax,
				yAxisLabel,
				yAxisRightMin,
				yAxisRightMax,
				yAxisRightLabel,
				children: [
					<ChartTooltip
						key='tooltip'
						active={disableTooltip ? false : undefined}
						animationDuration={150}
						animationEasing='linear'
						allowEscapeViewBox={{ y: false, x: false }}
						content={
							<ChartTooltipContent
								percent={isPercentStacked}
								isDualAxis={isDualAxis}
								hideTotal={hideTotal}
								labelFormatter={tooltipLabelFormatter}
								nameKey={isPie ? pieValueKey : undefined}
								valueFormatter={valueFormatter}
							/>
						}
					/>,
					chartType !== 'kpi_card' && (
						<Customized
							key='plot-width-observer'
							component={<ChartPlotWidthObserver onWidthChange={handlePlotWidthChange} />}
						/>
					),
					showLegend && chartType !== 'kpi_card' && !useInlineHeader && (
						<ChartLegend
							key='legend'
							payload={legendPayload}
							layout='horizontal'
							align='center'
							verticalAlign='bottom'
							content={
								<ChartLegendContent
									className={isPie ? styles.chartElementChartLegendContent : undefined}
									onItemClick={isPie ? undefined : handleToggleSeriesVisibility}
								/>
							}
						/>
					),
				].filter(Boolean),
				title: useInlineHeader ? undefined : title,
				renderTitle: false,
			}),
		[
			pieData,
			chartType,
			isPie,
			compactXAxis,
			compactXAxisInterval,
			xAxisTickFontSize,
			xAxisMaxLabelChars,
			xAxisKey,
			pieValueKey,
			xAxisType,
			xAxisLabel,
			visibleSeries,
			colorFor,
			labelFormatter,
			tooltipLabelFormatter,
			valueFormatter,
			showGrid,
			yAxisMin,
			yAxisMax,
			yAxisLabel,
			yAxisRightMin,
			yAxisRightMax,
			yAxisRightLabel,
			isDualAxis,
			showDataLabels,
			animate,
			comparisonMode,
			gradientIdPrefix,
			kpiLeadingSlot,
			hideTotal,
			handlePlotWidthChange,
			legendPayload,
			handleToggleSeriesVisibility,
			title,
			isPercentStacked,
			showLegend,
			useInlineHeader,
			disableTooltip,
			chartStyle,
		],
	);

	const inlineHeader = useInlineHeader ? (
		<div className={styles.inlineHeaderDiv}>
			<div className={showInlineLegend ? styles.inlineHeaderDiv2 : styles.inlineHeaderDiv3}>
				<span className={`${styles.inlineHeaderSpan} quarry-chart-title`}>{title}</span>
				{titleAccessory}
			</div>
			{showInlineLegend && canScrollLeft && (
				<Button
					variant='ghost-muted'
					size='icon-xs'
					onClick={() => scrollLegend('left')}
					aria-label='Scroll legend left'
					className={styles.inlineHeaderDiv3}
				>
					<ChevronLeft className={styles.inlineHeaderChevronLeft} />
				</Button>
			)}
			{showInlineLegend && (
				<div ref={scrollRef} className={styles.inlineHeaderDiv4}>
					<ChartLegendContent
						payload={legendPayload}
						align='right'
						onItemClick={handleToggleSeriesVisibility}
						className={styles.inlineHeaderChartLegendContent}
					/>
				</div>
			)}
			{showInlineLegend && canScrollRight && (
				<Button
					variant='ghost-muted'
					size='icon-xs'
					onClick={() => scrollLegend('right')}
					aria-label='Scroll legend right'
					className={styles.inlineHeaderDiv3}
				>
					<ChevronRight className={styles.inlineHeaderChevronLeft} />
				</Button>
			)}
		</div>
	) : undefined;

	return (
		<div
			ref={containerRef}
			className={cn(
				styles.chartDisplayDiv,
				chartType !== 'kpi_card' && normalSize ? styles.chartDisplayDiv2 : '',
				className,
			)}
		>
			{chartType === 'kpi_card' ? (
				<>
					{inlineHeader}
					{chartElement}
				</>
			) : (
				<ChartContainer
					config={chartConfig}
					className={cn(
						normalSize ? styles.chartDisplayChartContainer : styles.chartDisplayChartContainer2,
						pieCenteringClass,
						chartContainerClassName,
					)}
					contentClassName={cn(
						normalSize ? styles.chartDisplayChartContainer3 : undefined,
						chartContentClassName,
					)}
					header={inlineHeader}
				>
					{chartElement}
				</ChartContainer>
			)}
		</div>
	);
});

interface ChartPlotWidthObserverProps {
	offset?: { width?: number };
	onWidthChange: (width: number) => void;
}

function ChartPlotWidthObserver({ offset, onWidthChange }: ChartPlotWidthObserverProps) {
	const offsetWidth = offset?.width;

	useEffect(() => {
		if (typeof offsetWidth === 'number' && Number.isFinite(offsetWidth) && offsetWidth > 0) {
			onWidthChange(offsetWidth);
		}
	}, [offsetWidth, onWidthChange]);

	return null;
}

const useHorizontalScrollControls = () => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollState, setScrollState] = useState({
		canScrollLeft: false,
		canScrollRight: false,
	});

	const updateScrollState = useCallback(() => {
		const element = scrollRef.current;
		if (!element) {
			return;
		}

		const maxScrollLeft = element.scrollWidth - element.clientWidth;
		setScrollState({
			canScrollLeft: element.scrollLeft > 1,
			canScrollRight: element.scrollLeft < maxScrollLeft - 1,
		});
	}, []);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) {
			return;
		}

		updateScrollState();
		element.addEventListener('scroll', updateScrollState, { passive: true });

		if (typeof ResizeObserver === 'undefined') {
			return () => element.removeEventListener('scroll', updateScrollState);
		}

		const resizeObserver = new ResizeObserver(updateScrollState);
		resizeObserver.observe(element);

		if (element.firstElementChild) {
			resizeObserver.observe(element.firstElementChild);
		}

		return () => {
			element.removeEventListener('scroll', updateScrollState);
			resizeObserver.disconnect();
		};
	}, [updateScrollState]);

	const scrollLegend = useCallback((direction: 'left' | 'right') => {
		scrollRef.current?.scrollBy({
			left: direction === 'left' ? -LEGEND_SCROLL_OFFSET : LEGEND_SCROLL_OFFSET,
			behavior: 'smooth',
		});
	}, []);

	return {
		...scrollState,
		scrollRef,
		scrollLegend,
	};
};
