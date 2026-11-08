import { ENCOUNTER_STATUS_LABELS } from '@loopwise/shared/encounter';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { DAY_STATUSES, todayByStatus, TREND_DAYS, trendStart, visitsByDay } from './today-stats';
import styles from './today.module.css';
import type { DayStatus } from './today-stats';
import type { ChartConfig } from '@loopwise/shared/chart-tooltip';
import { PageSection } from '@/components/clinical/page-header';
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { encounterApi } from '@/lib/encounter-api';

const TREND_CONFIG = {
	consultation: { label: 'Consultations', color: 'var(--chart-1)' },
	followUp: { label: 'Follow-ups', color: 'var(--chart-2)' },
	other: { label: 'Other visits', color: 'var(--chart-3)' },
} satisfies ChartConfig;

/** The same hues as the summary cards: the queue blue, the doctor green, billing amber, done grey. */
const STATUS_COLORS: Record<DayStatus, string> = {
	OPEN: 'var(--chart-1)',
	IN_PROGRESS: 'var(--chart-3)',
	FOR_BILLING: 'var(--chart-5)',
	COMPLETED: 'var(--app-control-line)',
};

const STATUS_CONFIG: ChartConfig = Object.fromEntries(
	DAY_STATUSES.map((status) => [status, { label: ENCOUNTER_STATUS_LABELS[status], color: STATUS_COLORS[status] }]),
);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Every visit at the clinic over the chart's days (all statuses but cancelled), for both charts. */
function useRecentVisits(clinicId: string | undefined) {
	const startedFrom = useMemo(() => trendStart().toISOString(), []);
	return useQuery(encounterApi.encounter.atClinic.queryOptions(clinicId ? { clinicId, startedFrom } : skipToken));
}

/** The dashboard's chart row: visits per day for two weeks, and where today's visits stand. */
export function TodayCharts({ clinicId }: { clinicId: string | undefined }) {
	const visits = useRecentVisits(clinicId);
	if (!clinicId) {
		return null;
	}
	return (
		<div className={styles.grid}>
			<VisitsTrend visits={visits} />
			<TodayStatus visits={visits} />
		</div>
	);
}

type RecentVisits = ReturnType<typeof useRecentVisits>;

function ChartState({ visits, children }: { visits: RecentVisits; children: () => React.ReactNode }) {
	if (visits.isPending) {
		return <Skeleton className={styles.chartSkeleton} />;
	}
	if (visits.error) {
		return <ErrorMessage message={visits.error.message} />;
	}
	return children();
}

function VisitsTrend({ visits }: { visits: RecentVisits }) {
	const days = useMemo(() => visitsByDay(visits.data ?? []), [visits.data]);
	const total = days.reduce((sum, day) => sum + day.consultation + day.followUp + day.other, 0);
	const busiest = days.reduce(
		(best, day) => {
			const count = day.consultation + day.followUp + day.other;
			return count > best.count ? { label: day.label, count } : best;
		},
		{ label: '', count: 0 },
	);

	return (
		<PageSection title='Visits' meta={`Last ${TREND_DAYS} days`}>
			<ChartState visits={visits}>
				{() => (
					<>
						<p className={styles.chartTotal}>
							<span className='font-display text-2xl text-foreground'>{total}</span>
							<span className='text-sm text-muted-foreground'>
								{busiest.count > 0 ? `visits · busiest ${busiest.label} (${busiest.count})` : 'visits'}
							</span>
						</p>
						<ChartContainer
							config={TREND_CONFIG}
							contentClassName={styles.chart}
							role='img'
							aria-label={`Visits per day over the last ${TREND_DAYS} days: ${plural(total, 'visit')} in all${
								busiest.count > 0 ? `, the busiest day ${busiest.label} with ${busiest.count}` : ''
							}.`}
						>
							<BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
								<CartesianGrid vertical={false} stroke='var(--app-line)' strokeDasharray='3 3' />
								<XAxis
									dataKey='label'
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={16}
								/>
								<YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
								<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
								<ChartLegend content={<ChartLegendContent />} />
								<Bar dataKey='consultation' stackId='visits' fill='var(--color-consultation)' />
								<Bar dataKey='followUp' stackId='visits' fill='var(--color-followUp)' />
								<Bar dataKey='other' stackId='visits' fill='var(--color-other)' radius={[4, 4, 0, 0]} />
							</BarChart>
						</ChartContainer>
					</>
				)}
			</ChartState>
		</PageSection>
	);
}

function TodayStatus({ visits }: { visits: RecentVisits }) {
	const statuses = useMemo(() => todayByStatus(visits.data ?? []), [visits.data]);
	const total = statuses.reduce((sum, row) => sum + row.count, 0);
	const summary = statuses.map((row) => `${ENCOUNTER_STATUS_LABELS[row.status]} ${row.count}`).join(', ');

	return (
		<PageSection title="Today's visits by status" meta={plural(total, 'visit')}>
			<ChartState visits={visits}>
				{() => (
					<div className={styles.donutRow}>
						<ChartContainer
							config={STATUS_CONFIG}
							contentClassName={styles.donut}
							role='img'
							aria-label={`Today's ${plural(total, 'visit')} by status: ${summary}.`}
						>
							<PieChart>
								{total > 0 && (
									<ChartTooltip
										cursor={false}
										content={<ChartTooltipContent nameKey='status' hideLabel />}
									/>
								)}
								<Pie
									data={total > 0 ? statuses : [{ status: 'none', count: 1 }]}
									dataKey='count'
									nameKey='status'
									innerRadius='62%'
									outerRadius='92%'
									strokeWidth={2}
									stroke='var(--app-surface)'
									isAnimationActive={total > 0}
								>
									{total > 0 ? (
										statuses.map((row) => (
											<Cell key={row.status} fill={STATUS_COLORS[row.status]} />
										))
									) : (
										<Cell fill='var(--app-fill)' />
									)}
									<Label
										content={({ viewBox }) =>
											viewBox && 'cx' in viewBox ? (
												<text x={viewBox.cx} y={viewBox.cy} textAnchor='middle'>
													<tspan
														x={viewBox.cx}
														dy='-0.1em'
														className='fill-foreground font-display text-2xl'
													>
														{total}
													</tspan>
													<tspan
														x={viewBox.cx}
														dy='1.5em'
														className='fill-muted-foreground text-xs'
													>
														today
													</tspan>
												</text>
											) : null
										}
									/>
								</Pie>
							</PieChart>
						</ChartContainer>
						<ul className={styles.donutLegend}>
							{statuses.map((row) => (
								<li key={row.status}>
									<span
										className={styles.swatch}
										style={{ backgroundColor: STATUS_COLORS[row.status] }}
										aria-hidden
									/>
									<span className='text-muted-foreground'>{ENCOUNTER_STATUS_LABELS[row.status]}</span>
									<span className='ml-auto font-semibold text-foreground tabular-nums'>
										{row.count}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</ChartState>
		</PageSection>
	);
}
