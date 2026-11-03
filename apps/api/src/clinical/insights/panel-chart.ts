import { icd10Chapter } from '@quarry/shared/icd10-chapters';
import { chartFacilityPanel, clinicalChart } from '@quarry/shared/tools';

type PanelMetric = chartFacilityPanel.PanelMetric;
type ChartSpec = clinicalChart.ChartSpec;

const DAY = 24 * 60 * 60 * 1000;
const TOP_CHAPTERS = 10;

/** The rows each panel metric is counted from, as `InsightsRepository` reads them. */
export interface PanelData {
	encounters: { startedAt: Date }[];
	diagnoses: { icd10Code: string }[];
	openOrders: { sentAt: Date | null; createdAt: Date }[];
	awaitingReview: { flag: string | null }[];
}

const AGE_BUCKETS = [
	{ label: '0–2 days', maxDays: 2 },
	{ label: '3–7 days', maxDays: 7 },
	{ label: '8–14 days', maxDays: 14 },
	{ label: 'Over 14 days', maxDays: Infinity },
] as const;

const FLAG_ORDER = ['critical_high', 'critical_low', 'high', 'low', 'abnormal', 'normal', 'none'];

const day = (date: Date) => date.toISOString().slice(0, 10);

/** The Monday (UTC) of the week `date` falls in. */
export function weekStart(date: Date): string {
	const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
	return day(monday);
}

const bar = (
	title: string,
	xAxisKey: string,
	key: string,
	label: string,
	rows: ChartSpec['rows'],
	chartType: 'bar' | 'horizontal_bar' = 'bar',
): ChartSpec => ({
	title,
	chartType,
	xAxisKey,
	unit: 'count',
	yAxisLabel: label,
	rows,
	series: [{ data_key: key, label, color: clinicalChart.CHART_COLORS.primary, value_format: { d3_format: ',.0f' } }],
});

/** One panel metric as a bar chart; weeks with no encounter still get a bar, so gaps show. */
export function buildPanelChart(metric: PanelMetric, data: PanelData, since: Date, today: Date): ChartSpec {
	const title = chartFacilityPanel.METRIC_LABELS[metric];
	switch (metric) {
		case 'encounters_by_week': {
			const counts = new Map<string, number>();
			for (let at = new Date(since); at <= today; at = new Date(at.getTime() + 7 * DAY)) {
				counts.set(weekStart(at), 0);
			}
			counts.set(weekStart(today), counts.get(weekStart(today)) ?? 0);
			for (const encounter of data.encounters) {
				const week = weekStart(encounter.startedAt);
				counts.set(week, (counts.get(week) ?? 0) + 1);
			}
			const rows = [...counts.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([week, encounters]) => ({ week, encounters }));
			return bar(title, 'week', 'encounters', 'Encounters', rows);
		}
		case 'diagnoses_by_icd10_chapter': {
			const counts = new Map<string, number>();
			for (const { icd10Code } of data.diagnoses) {
				const chapter = icd10Chapter(icd10Code) ?? 'Other codes';
				counts.set(chapter, (counts.get(chapter) ?? 0) + 1);
			}
			const rows = [...counts.entries()]
				.sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
				.slice(0, TOP_CHAPTERS)
				.map(([chapter, diagnoses]) => ({ chapter, diagnoses }));
			// Chapter names are long: horizontal bars keep them readable.
			return bar(title, 'chapter', 'diagnoses', 'Diagnoses', rows, 'horizontal_bar');
		}
		case 'open_orders_by_age': {
			const counts = AGE_BUCKETS.map(() => 0);
			for (const order of data.openOrders) {
				const ageDays = Math.floor((today.getTime() - (order.sentAt ?? order.createdAt).getTime()) / DAY);
				counts[AGE_BUCKETS.findIndex((bucket) => ageDays <= bucket.maxDays)]++;
			}
			const rows = AGE_BUCKETS.map((bucket, index) => ({ age: bucket.label, orders: counts[index] }));
			return bar(title, 'age', 'orders', 'Open orders', rows);
		}
		case 'results_awaiting_review': {
			const counts = new Map<string, number>();
			for (const { flag } of data.awaitingReview) {
				counts.set(flag ?? 'none', (counts.get(flag ?? 'none') ?? 0) + 1);
			}
			const rows = [...counts.entries()]
				.sort(([a], [b]) => FLAG_ORDER.indexOf(a) - FLAG_ORDER.indexOf(b))
				.map(([flag, results]) => ({ flag: flag.replace('_', ' '), results }));
			return bar(title, 'flag', 'results', 'Results', rows);
		}
	}
}
