import { isBuiltinChartType } from '@quarry/shared/chart-types';
import { memo, useMemo } from 'react';

import { McpAppHeader } from './mcp-app-header';
import { OpenInQuarryButton } from './open-in-quarry-button';
import styles from './chart-app-view.module.css';
import type { displayChart } from '@quarry/shared/tools';
import type { ReactNode } from 'react';
import type { McpChartEmbedStoredConfig } from '@quarry/shared';
import { sortByDateKey } from '@/lib/charts.utils';
import { ChartDisplay } from '@/feature/chat/components/tool-calls/display-chart';

interface ChartAppViewProps {
	config: McpChartEmbedStoredConfig;
	data: Record<string, unknown>[];
	quarryUrl?: string;
}

export const ChartAppView = memo(function ChartAppView({ config, data, quarryUrl }: ChartAppViewProps) {
	const chartData = useMemo(
		() => (config.xAxisType === 'date' ? sortByDateKey(data, config.xAxisKey) : data),
		[data, config.xAxisKey, config.xAxisType],
	);

	const series = useMemo(
		(): displayChart.SeriesConfig[] =>
			config.series.map((s, i) => ({
				data_key: s.data_key,
				color: s.color ?? `var(--chart-${(i % 5) + 1})`,
				label: s.label,
				is_total: s.is_total,
				series_type: s.series_type,
				y_axis: s.y_axis,
			})),
		[config.series],
	);

	const xAxisType = config.xAxisType === 'number' ? 'number' : ('category' as const);

	let body: ReactNode;
	if (!chartData.length) {
		body = <div className={styles.chartAppViewDiv}>Chart data unavailable.</div>;
	} else if (series.length === 0) {
		body = <div className={styles.chartAppViewDiv}>No series configured for this chart.</div>;
	} else if (!isBuiltinChartType(config.chartType)) {
		body = <div className={styles.chartAppViewDiv}>Custom charts are available in web chats only.</div>;
	} else {
		body = (
			<div className={`${styles.chartAppViewDiv2} ${config.chartType !== 'kpi_card' ? styles.state100 : ''}`}>
				<ChartDisplay
					data={chartData}
					chartType={config.chartType}
					xAxisKey={config.xAxisKey}
					xAxisType={xAxisType}
					xAxisLabel={config.xAxisLabel}
					series={series}
					title={config.title}
					yAxisMin={config.yAxisMin}
					yAxisMax={config.yAxisMax}
					yAxisLabel={config.yAxisLabel}
					yAxisRightMin={config.yAxisRightMin}
					yAxisRightMax={config.yAxisRightMax}
					yAxisRightLabel={config.yAxisRightLabel}
				/>
			</div>
		);
	}

	return (
		<div className={styles.chartAppViewDiv3}>
			<McpAppHeader title={config.title}>
				{quarryUrl ? <OpenInQuarryButton url={quarryUrl} /> : null}
			</McpAppHeader>
			<div className={styles.chartAppViewDiv4}>
				<div className={styles.chartAppViewDiv5}>{body}</div>
			</div>
		</div>
	);
});
