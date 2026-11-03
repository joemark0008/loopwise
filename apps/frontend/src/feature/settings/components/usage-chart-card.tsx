import styles from './usage-chart-card.module.css';
import type { ReactNode } from 'react';
import type { displayChart } from '@loopwise/shared/tools';
import type { TotalUsageRecord, UsageRecord } from '@loopwise/shared/usage';
import { ChartDisplay } from '@/feature/chat/components/tool-calls/display-chart';

export type UsageChartData = UsageRecord[] | TotalUsageRecord[] | Record<string, string | number>[];

export interface UsageChartCardProps {
	title: string;
	isLoading: boolean;
	isFetching: boolean;
	isError: boolean;
	data: UsageChartData;
	chartType: 'bar' | 'stacked_bar' | 'kpi_card';
	series: displayChart.SeriesConfig[];
	xAxisLabelFormatter?: (value: string) => string;
	valueFormatter?: (value: number) => string;
	titleAccessory?: ReactNode;
	showLegend?: boolean;
}

export function UsageChartCard({
	title,
	isLoading,
	isFetching,
	isError,
	data,
	chartType,
	series,
	xAxisLabelFormatter,
	valueFormatter,
	titleAccessory,
	showLegend,
}: UsageChartCardProps) {
	return (
		<div className={styles.card}>
			{isError ? (
				<div className={styles.state}>
					<p className={styles.stateText}>Error loading usage data.</p>
				</div>
			) : isLoading && data.length === 0 ? (
				<div className={styles.state}>
					<p className={styles.stateText}>Loading usage data...</p>
				</div>
			) : data.length === 0 ? (
				<div className={styles.state}>
					<p className={styles.stateText}>No usage data available yet.</p>
				</div>
			) : (
				<div className={isFetching ? styles.fetching : undefined}>
					<ChartDisplay
						title={title}
						titleStyle='left'
						data={data as unknown as Record<string, unknown>[]}
						chartType={chartType}
						xAxisKey='date'
						xAxisType='category'
						xAxisLabelFormatter={xAxisLabelFormatter}
						valueFormatter={valueFormatter}
						series={series}
						titleAccessory={titleAccessory}
						showLegend={showLegend}
						showGrid={true}
						chartContainerClassName={chartType === 'kpi_card' ? undefined : styles.chartContainer}
						chartContentClassName={chartType === 'kpi_card' ? undefined : styles.chartContent}
					/>
				</div>
			)}
		</div>
	);
}
