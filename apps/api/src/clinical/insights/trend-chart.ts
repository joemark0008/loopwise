import { chartPatientTrend, clinicalChart } from '@quarry/shared/tools';

import type { Prisma } from '../../generated/prisma/client.js';

type PatientMeasure = chartPatientTrend.PatientMeasure;
type ChartSpec = clinicalChart.ChartSpec;
const { CHART_COLORS } = clinicalChart;
const { MEASURE_LABELS } = chartPatientTrend;

type VitalsRow = Pick<
	Prisma.VitalSignsGetPayload<object>,
	'recordedAt' | 'systolicMmHg' | 'diastolicMmHg' | 'heartRateBpm' | 'weightKg' | 'bmi' | 'bloodGlucoseMgDl'
>;
type ResultRow = Pick<Prisma.ResultGetPayload<object>, 'code' | 'resultedAt' | 'valueNumeric'>;

/** LOINC codes of the lab measures (the seed's and the orderable tests'). */
export const LAB_CODES: Partial<Record<PatientMeasure, string>> = { hba1c: '4548-4', fbs: '1558-6' };

/** Thresholds drawn as a flat line: the diagnostic cut-offs the pathways use (DESIGN.md §8), not targets. */
const THRESHOLDS = {
	systolic: 140,
	diastolic: 90,
	hba1c: 6.5,
	fbs: 126,
} as const;

const day = (date: Date) => date.toISOString().slice(0, 10);
const num = (value: Prisma.Decimal | number | null) => (value === null ? null : Number(value));
const format = (d3: string, suffix: string) => ({ d3_format: d3, suffix });

/** The chart of one measure from the patient's vitals or results, oldest first. */
export function buildTrendChart(measure: PatientMeasure, vitals: VitalsRow[], results: ResultRow[]): ChartSpec {
	const title = MEASURE_LABELS[measure];
	switch (measure) {
		case 'blood_pressure': {
			const rows = vitals
				.filter((row) => row.systolicMmHg !== null)
				.map((row) => ({
					date: day(row.recordedAt),
					systolic: row.systolicMmHg,
					diastolic: row.diastolicMmHg,
					systolic_threshold: THRESHOLDS.systolic,
					diastolic_threshold: THRESHOLDS.diastolic,
				}));
			const mmHg = format('.0f', ' mmHg');
			return {
				title,
				chartType: 'line',
				xAxisKey: 'date',
				unit: 'mmHg',
				yAxisLabel: 'mmHg',
				rows,
				series: [
					{ data_key: 'systolic', label: 'Systolic', color: CHART_COLORS.primary, value_format: mmHg },
					{ data_key: 'diastolic', label: 'Diastolic', color: CHART_COLORS.secondary, value_format: mmHg },
					{
						data_key: 'systolic_threshold',
						label: 'Systolic 140',
						color: CHART_COLORS.threshold,
						value_format: mmHg,
					},
					{
						data_key: 'diastolic_threshold',
						label: 'Diastolic 90',
						color: CHART_COLORS.threshold,
						value_format: mmHg,
					},
				],
			};
		}
		case 'weight_bmi': {
			const rows = vitals
				.filter((row) => row.weightKg !== null || row.bmi !== null)
				.map((row) => ({ date: day(row.recordedAt), weight: num(row.weightKg), bmi: num(row.bmi) }));
			return {
				title,
				chartType: 'mixed',
				xAxisKey: 'date',
				unit: 'kg',
				yAxisLabel: 'kg',
				yAxisRightLabel: 'BMI',
				rows,
				series: [
					{
						data_key: 'weight',
						label: 'Weight',
						color: CHART_COLORS.primary,
						series_type: 'line',
						y_axis: 'left',
						value_format: format('.1f', ' kg'),
					},
					{
						data_key: 'bmi',
						label: 'BMI',
						color: CHART_COLORS.secondary,
						series_type: 'line',
						y_axis: 'right',
						value_format: format('.1f', ''),
					},
				],
			};
		}
		case 'heart_rate':
			return singleVital(title, 'bpm', vitals, (row) => row.heartRateBpm, 'heart_rate', 'Heart rate');
		case 'capillary_glucose':
			return singleVital(title, 'mg/dL', vitals, (row) => row.bloodGlucoseMgDl, 'glucose', 'Glucose');
		case 'hba1c':
		case 'fbs': {
			const unit = measure === 'hba1c' ? '%' : 'mg/dL';
			const threshold = THRESHOLDS[measure];
			const rows = results
				.filter((row) => row.code === LAB_CODES[measure] && row.valueNumeric !== null)
				.map((row) => ({ date: day(row.resultedAt), value: num(row.valueNumeric), threshold }));
			const valueFormat = format(measure === 'hba1c' ? '.1f' : '.0f', measure === 'hba1c' ? '%' : ' mg/dL');
			return {
				title,
				chartType: 'line',
				xAxisKey: 'date',
				unit,
				yAxisLabel: unit,
				rows,
				series: [
					{ data_key: 'value', label: title, color: CHART_COLORS.primary, value_format: valueFormat },
					{
						data_key: 'threshold',
						label: `Diabetes ${threshold}${measure === 'hba1c' ? '%' : ''}`,
						color: CHART_COLORS.threshold,
						value_format: valueFormat,
					},
				],
			};
		}
	}
}

function singleVital(
	title: string,
	unit: string,
	vitals: VitalsRow[],
	pick: (row: VitalsRow) => number | null,
	key: string,
	label: string,
): ChartSpec {
	const rows = vitals
		.filter((row) => pick(row) !== null)
		.map((row) => ({ date: day(row.recordedAt), [key]: pick(row) }));
	return {
		title,
		chartType: 'line',
		xAxisKey: 'date',
		unit,
		yAxisLabel: unit,
		rows,
		series: [{ data_key: key, label, color: CHART_COLORS.primary, value_format: format('.0f', ` ${unit}`) }],
	};
}
