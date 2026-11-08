import type { EncounterType } from '@loopwise/shared/encounter';

/** How many days the visits chart covers, today included. */
export const TREND_DAYS = 14;

/** The statuses the donut shows, in the order a visit moves through them (cancelled visits are left out). */
export const DAY_STATUSES = ['OPEN', 'IN_PROGRESS', 'FOR_BILLING', 'COMPLETED'] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

interface VisitPoint {
	startedAt: string;
	type: EncounterType;
	status: string;
}

export interface DayBucket {
	/** Local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** Short axis label, e.g. `Nov 8`. */
	label: string;
	consultation: number;
	followUp: number;
	other: number;
}

/** Local midnight `days - 1` days before `today`: the first day the chart covers. */
export function trendStart(today = new Date(), days = TREND_DAYS): Date {
	const start = new Date(today);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - (days - 1));
	return start;
}

const dayKey = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' });

/** One bucket per local day from `trendStart` to today, every day present (zero when no visits), oldest first. */
export function visitsByDay(visits: readonly VisitPoint[], today = new Date(), days = TREND_DAYS): DayBucket[] {
	const start = trendStart(today, days);
	const buckets = new Map<string, DayBucket>();
	for (let offset = 0; offset < days; offset++) {
		const date = new Date(start);
		date.setDate(start.getDate() + offset);
		const key = dayKey(date);
		buckets.set(key, { date: key, label: dayLabel.format(date), consultation: 0, followUp: 0, other: 0 });
	}
	for (const visit of visits) {
		if (visit.status === 'CANCELLED') {
			continue;
		}
		const bucket = buckets.get(dayKey(new Date(visit.startedAt)));
		if (!bucket) {
			continue;
		}
		if (visit.type === 'CONSULTATION') {
			bucket.consultation++;
		} else if (visit.type === 'FOLLOW_UP') {
			bucket.followUp++;
		} else {
			bucket.other++;
		}
	}
	return [...buckets.values()];
}

/** Today's visits per status, in `DAY_STATUSES` order. */
export function todayByStatus(
	visits: readonly VisitPoint[],
	today = new Date(),
): { status: DayStatus; count: number }[] {
	const key = dayKey(today);
	const counts = new Map<string, number>();
	for (const visit of visits) {
		if (dayKey(new Date(visit.startedAt)) === key) {
			counts.set(visit.status, (counts.get(visit.status) ?? 0) + 1);
		}
	}
	return DAY_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}
