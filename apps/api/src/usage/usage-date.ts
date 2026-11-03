import {
	type Granularity,
	resolveUsageChartGranularity,
	type UsagePeriodRange,
	type UsageRecord,
} from './usage.types.js';

/** The usage half of upstream `utils/date.ts` (calendar buckets of the usage charts). */

export function getLookbackTimestamp(period: UsagePeriodRange): number {
	const start = new Date();
	moveToBucket(start, period.unit, period.value - 1);
	return start.getTime();
}

export function formatDate(date: Date, granularity: Granularity): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hour = String(date.getUTCHours()).padStart(2, '0');

	switch (granularity) {
		case 'hour':
			return `${year}-${month}-${day} ${hour}:00`;
		case 'day':
			return `${year}-${month}-${day}`;
		case 'month':
			return `${year}-${month}`;
	}
}

export function generateDateSeries(
	period: UsagePeriodRange,
	granularity: Granularity = resolveUsageChartGranularity(period),
): string[] {
	if (granularity !== period.unit) {
		return generateCoarsenedDateSeries(period, granularity);
	}

	const dates: string[] = [];
	const now = new Date();

	for (let i = period.value - 1; i >= 0; i--) {
		const date = new Date(now);
		moveToBucket(date, granularity, i);
		dates.push(formatDate(date, granularity));
	}

	return dates;
}

function generateCoarsenedDateSeries(period: UsagePeriodRange, granularity: Granularity): string[] {
	const dates: string[] = [];
	const firstBucket = new Date(getLookbackTimestamp(period));
	moveToBucket(firstBucket, granularity, 0);
	const date = new Date();
	moveToBucket(date, granularity, 0);

	while (date.getTime() >= firstBucket.getTime()) {
		dates.push(formatDate(date, granularity));
		moveToBucket(date, granularity, 1);
	}

	return dates.reverse();
}

function moveToBucket(date: Date, granularity: Granularity, bucketsBack: number): void {
	switch (granularity) {
		case 'hour':
			date.setUTCHours(date.getUTCHours() - bucketsBack, 0, 0, 0);
			break;
		case 'day':
			date.setUTCDate(date.getUTCDate() - bucketsBack);
			date.setUTCHours(0, 0, 0, 0);
			break;
		case 'month':
			date.setUTCMonth(date.getUTCMonth() - bucketsBack, 1);
			date.setUTCHours(0, 0, 0, 0);
			break;
	}
}

export function fillMissingDates(
	records: UsageRecord[],
	period: UsagePeriodRange,
	granularity: Granularity = resolveUsageChartGranularity(period),
): UsageRecord[] {
	const dateSet = new Map(records.map((r) => [r.date, r]));
	const allDates = generateDateSeries(period, granularity);

	return allDates.map(
		(date) =>
			dateSet.get(date) ?? {
				date,
				messageCount: 0,
				webMessageCount: 0,
				slackMessageCount: 0,
				teamsMessageCount: 0,
				telegramMessageCount: 0,
				mattermostMessageCount: 0,
				discordMessageCount: 0,
				whatsappMessageCount: 0,
				adminMessageCount: 0,
				mcpMessageCount: 0,
				contextRecommendationsMessageCount: 0,
				inputNoCacheTokens: 0,
				inputCacheReadTokens: 0,
				inputCacheWriteTokens: 0,
				outputTotalTokens: 0,
				totalTokens: 0,
				inputNoCacheCost: 0,
				inputCacheReadCost: 0,
				inputCacheWriteCost: 0,
				outputCost: 0,
				totalCost: 0,
			},
	);
}
