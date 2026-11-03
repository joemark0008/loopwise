import { Activity } from 'lucide-react';
import { memo, useState } from 'react';
import styles from './clinical-chart.module.css';
import { ChartDisplay } from './display-chart';
import type { clinicalChart } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';

/**
 * Wise's `chart_patient_trend` and `chart_facility_panel` (DESIGN.md §9.2): a patient's vitals or lab trend, or counts
 * across the user's facility, drawn from the rows the server read as the user. Thresholds are flat series; the data
 * view lists the exact values.
 */
export const ClinicalChartToolCall = memo(
	({ toolPart }: ToolCallComponentProps<'chart_patient_trend'> | ToolCallComponentProps<'chart_facility_panel'>) => {
		if (toolPart.state === 'output-error') {
			return <ErrorMessage message={toolPart.errorText} />;
		}
		if (toolPart.state !== 'output-available' || !toolPart.output) {
			return null;
		}
		const { output } = toolPart;
		const subject = 'patient' in output ? output.patient.name : output.facility.name;
		return <ClinicalChartCard chart={output.chart} subject={subject} months={output.months} />;
	},
);

function ClinicalChartCard({
	chart,
	subject,
	months,
}: {
	chart: clinicalChart.ChartSpec;
	subject: string;
	months: number;
}) {
	const [view, setView] = useState<'chart' | 'data'>('chart');
	const unit = chart.unit === 'count' ? 'row' : 'reading';
	return (
		<div className={styles.card} data-testid='clinical-chart'>
			<div className={styles.header}>
				<Activity />
				<span className={styles.title}>{chart.title}</span>
				<span className={styles.meta}>
					{subject} · last {months} months · {chart.rows.length} {unit}
					{chart.rows.length === 1 ? '' : 's'}
				</span>
				{chart.rows.length > 0 && (
					<Button
						variant='ghost-muted'
						size='sm'
						className={styles.toggle}
						onClick={() => setView(view === 'chart' ? 'data' : 'chart')}
					>
						{view === 'chart' ? 'Data' : 'Chart'}
					</Button>
				)}
			</div>
			{view === 'data' ? <ChartDataTable chart={chart} /> : <ClinicalChartView chart={chart} months={months} />}
		</div>
	);
}

/** A clinical chart spec drawn with the shared chart builder, or an empty state. */
export function ClinicalChartView({ chart, months }: { chart: clinicalChart.ChartSpec; months?: number }) {
	if (chart.rows.length === 0) {
		return (
			<p className={styles.empty}>
				No {chart.title.toLowerCase()} readings{months ? ` in the last ${months} months` : ''}.
			</p>
		);
	}
	return (
		<div className={styles.chart}>
			<ChartDisplay
				data={chart.rows}
				chartType={chart.chartType}
				xAxisKey={chart.xAxisKey}
				xAxisType='category'
				series={chart.series}
				yAxisLabel={chart.yAxisLabel}
				yAxisRightLabel={chart.yAxisRightLabel}
				normalSize
			/>
		</div>
	);
}

function ChartDataTable({ chart }: { chart: clinicalChart.ChartSpec }) {
	const series = chart.series.filter((entry) => !entry.data_key.endsWith('threshold'));
	return (
		<table className={styles.table}>
			<thead>
				<tr>
					<th>
						{chart.xAxisKey === 'date' ? 'Date' : chart.xAxisKey[0].toUpperCase() + chart.xAxisKey.slice(1)}
					</th>
					{series.map((entry) => (
						<th key={entry.data_key}>{entry.label ?? entry.data_key}</th>
					))}
				</tr>
			</thead>
			<tbody>
				{chart.rows.map((row, index) => (
					<tr key={index}>
						<td>{row[chart.xAxisKey]}</td>
						{series.map((entry) => (
							<td key={entry.data_key}>{row[entry.data_key] ?? '—'}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
