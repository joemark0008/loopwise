import { useEffect } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import styles from './usage-page.module.css';
import type { TokenChartDisplayMode, UsageRouteSearch } from '@/feature/settings/components/usage-route-search';
import type { UsageChartData } from '@/feature/settings/components/usage-chart-card';
import type { displayChart } from '@loopwise/shared/tools';
import type { UsageRecord } from '@loopwise/shared/usage';
import { UsageChartCard } from '@/feature/settings/components/usage-chart-card';
import { UsageFilters } from '@/feature/settings/components/usage-filters';
import { saveUsageFilters, validateUsageSearch } from '@/feature/settings/components/usage-route-search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsPageWrapper } from '@/components/ui/settings-card';
import { usePermissions } from '@/hooks/use-permissions';
import { useUsagePeriodSettings } from '@/hooks/use-usage-period-settings';
import { buildUserUsageChart } from '@/lib/usage-by-user';
import { formatUsageBucketLabel } from '@/lib/usage-date';
import { usageApi } from '@/lib/usage-api';

const Route = getRouteApi('/_protected/settings/usage');

const USD_VALUE_FORMAT = {
	d3_format: ',.2f',
	prefix: '$',
	compact: 'financial',
} satisfies displayChart.ValueFormat;

interface UsageChart {
	data: UsageChartData;
	series: displayChart.SeriesConfig[];
	showLegend: boolean;
}

const tokenChartDisplayOptions: { value: TokenChartDisplayMode; label: string }[] = [
	{ value: 'tokens', label: 'Show in tokens' },
	{ value: 'dollars', label: 'Show in dollars' },
];

const tokenSeries = [
	{ data_key: 'inputNoCacheTokens', color: 'var(--chart-1)', label: 'Input' },
	{ data_key: 'inputCacheReadTokens', color: 'var(--chart-2)', label: 'Cache read' },
	{ data_key: 'inputCacheWriteTokens', color: 'var(--chart-3)', label: 'Cache write' },
	{ data_key: 'outputTotalTokens', color: 'var(--chart-4)', label: 'Output' },
];

const costSeries = [
	{ data_key: 'inputNoCacheCost', color: 'var(--chart-1)', label: 'Input', value_format: USD_VALUE_FORMAT },
	{ data_key: 'inputCacheReadCost', color: 'var(--chart-2)', label: 'Cache read', value_format: USD_VALUE_FORMAT },
	{ data_key: 'inputCacheWriteCost', color: 'var(--chart-3)', label: 'Cache write', value_format: USD_VALUE_FORMAT },
	{ data_key: 'outputCost', color: 'var(--chart-4)', label: 'Output', value_format: USD_VALUE_FORMAT },
];

const messageSeries = [
	{ data_key: 'webMessageCount', color: 'var(--chart-1)', label: 'Web' },
	{ data_key: 'slackMessageCount', color: 'var(--chart-2)', label: 'Slack' },
	{ data_key: 'teamsMessageCount', color: 'var(--chart-3)', label: 'Teams' },
	{ data_key: 'telegramMessageCount', color: 'var(--chart-4)', label: 'Telegram' },
	{ data_key: 'whatsappMessageCount', color: 'var(--chart-5)', label: 'WhatsApp' },
	{ data_key: 'adminMessageCount', color: 'var(--chart-6)', label: 'Admin mode' },
	{ data_key: 'mcpMessageCount', color: 'var(--chart-7)', label: 'MCP' },
	{
		data_key: 'contextRecommendationsMessageCount',
		color: 'var(--chart-8)',
		label: 'Context recommendations',
	},
] as const;

/**
 * Port of upstream `routes/_sidebar-layout.settings.usage.tsx` (Settings → Usage): messages, tokens and cost of the
 * clinic, scoped to the user unless they are a clinic admin. Chat replay is not ported (docs/deferred-features.md).
 */
export function UsagePage() {
	const usageSearch = Route.useSearch();
	const navigate = Route.useNavigate();
	const { canViewAllUsage, canViewUsage } = usePermissions();

	useEffect(() => {
		saveUsageFilters(usageSearch);
	}, [usageSearch]);

	const updateSearch = (next: Partial<UsageRouteSearch>) => {
		navigate({
			search: (current) => validateUsageSearch({ ...current, ...next }),
			replace: true,
		});
	};

	return (
		<SettingsPageWrapper full>
			<div className={styles.page}>
				<div>
					<h1 className={styles.title}>Usage</h1>
					<p className={styles.description}>
						Messages, tokens and cost of the models this clinic calls, chats and background tasks included.{' '}
						{canViewAllUsage ? 'As a clinic admin you see every member.' : 'You see your own usage.'}
					</p>
				</div>
				<UsageOverview
					usageSearch={usageSearch}
					onUpdateSearch={updateSearch}
					canViewAllUsage={canViewAllUsage}
					canViewUsage={canViewUsage}
				/>
			</div>
		</SettingsPageWrapper>
	);
}

function UsageOverview({
	usageSearch,
	onUpdateSearch,
	canViewAllUsage,
	canViewUsage,
}: {
	usageSearch: UsageRouteSearch;
	onUpdateSearch: (next: Partial<UsageRouteSearch>) => void;
	canViewAllUsage: boolean;
	canViewUsage: boolean;
}) {
	const { provider, users, sources, splitByUser, tokenView } = usageSearch;
	const periodState = useUsagePeriodSettings({ canViewUsage, usageSearch, onUpdateSearch });
	const { period, granularity } = periodState;

	const usedProviders = useQuery({
		...usageApi.usage.getUsedProviders.queryOptions(),
		enabled: canViewUsage,
	});
	const userFacets = useQuery({
		...usageApi.usage.getUserFacets.queryOptions(),
		enabled: canViewAllUsage,
	});
	const splitUsageByUser = canViewAllUsage && splitByUser;
	const chartFilter = {
		period,
		granularity,
		provider: provider === 'all' ? undefined : provider,
		userNames: canViewAllUsage ? users : undefined,
		sources,
	};
	const messagesUsage = useQuery({
		...usageApi.usage.getMessagesUsage.queryOptions(chartFilter),
		placeholderData: keepPreviousData,
		enabled: canViewUsage && periodState.isReady && !splitUsageByUser,
	});
	const usageByUser = useQuery({
		...usageApi.usage.getMessagesUsageByUser.queryOptions(chartFilter),
		placeholderData: keepPreviousData,
		enabled: canViewUsage && periodState.isReady && splitUsageByUser,
	});
	const totalUsage = useQuery({
		...usageApi.usage.getTotalUsage.queryOptions({
			period,
			provider: provider === 'all' ? undefined : provider,
			userNames: canViewAllUsage ? users : undefined,
			sources,
		}),
		placeholderData: keepPreviousData,
		enabled: canViewUsage && periodState.isReady,
	});

	const chartData = messagesUsage.data ?? [];
	const chartDataByUser = usageByUser.data ?? [];
	const chartQuery = splitUsageByUser ? usageByUser : messagesUsage;
	const totalUsageChartData = totalUsage.data ? [totalUsage.data] : [];
	const showCost = tokenView === 'dollars';
	const messagesChart: UsageChart = splitUsageByUser
		? buildUserUsageChart(chartDataByUser, 'messageCount')
		: buildMessagesBySourceChart(chartData);
	const tokensChart: UsageChart = splitUsageByUser
		? buildUserUsageChart(
				chartDataByUser,
				showCost ? 'totalCost' : 'totalTokens',
				showCost ? USD_VALUE_FORMAT : undefined,
			)
		: { data: chartData, series: showCost ? costSeries : tokenSeries, showLegend: true };

	return (
		<div className={styles.overview}>
			<UsageFilters
				showUsageControls={canViewUsage}
				showUserControls={canViewAllUsage}
				provider={provider}
				onProviderChange={(value) => onUpdateSearch({ provider: value })}
				periodSelection={periodState.selection}
				onPeriodSelectionChange={periodState.selectPeriod}
				savedPeriods={periodState.savedPeriods}
				isPeriodLoading={periodState.isLoading}
				periodError={periodState.error}
				onRetryPeriod={periodState.retry}
				onCreateSavedPeriod={periodState.createSavedPeriod}
				onUpdateSavedPeriod={periodState.updateSavedPeriod}
				onDeleteSavedPeriod={periodState.deleteSavedPeriod}
				availableProviders={usedProviders.data}
				chatFacets={userFacets.data}
				selectedUserNames={users}
				onSelectedUserNamesChange={(value) => onUpdateSearch({ users: value })}
				selectedSources={sources}
				onSelectedSourcesChange={(value) => onUpdateSearch({ sources: value })}
				splitByUser={splitByUser}
				onSplitByUserChange={(value) => onUpdateSearch({ splitByUser: value })}
			/>

			{canViewUsage && (
				<div className={styles.charts}>
					<div className={styles.kpi}>
						<UsageChartCard
							title='Messages'
							isLoading={periodState.isLoading || totalUsage.isLoading}
							isFetching={totalUsage.isFetching}
							isError={totalUsage.isError}
							data={totalUsageChartData}
							chartType='kpi_card'
							series={[
								{
									data_key: 'totalMessages',
									label: 'Total messages',
									color: 'var(--chart-1)',
								},
								...(canViewAllUsage
									? [
											{
												data_key: 'uniqueUsers',
												label: 'Unique users',
												color: 'var(--chart-2)',
											},
										]
									: []),
							]}
						/>
					</div>

					<UsageChartCard
						title='Messages'
						isLoading={periodState.isLoading || chartQuery.isLoading}
						isFetching={chartQuery.isFetching}
						isError={chartQuery.isError}
						data={messagesChart.data}
						chartType='stacked_bar'
						xAxisLabelFormatter={(value) => formatUsageBucketLabel(value, granularity)}
						titleAccessory={
							<span className={styles.chartCaption}>
								{splitUsageByUser ? 'Number of messages by user' : 'Number of messages by source'}
							</span>
						}
						series={messagesChart.series}
						showLegend={messagesChart.showLegend}
					/>

					<UsageChartCard
						title={showCost ? 'Cost' : 'Tokens'}
						isLoading={periodState.isLoading || chartQuery.isLoading}
						isFetching={chartQuery.isFetching}
						isError={chartQuery.isError}
						data={tokensChart.data}
						chartType='stacked_bar'
						xAxisLabelFormatter={(value) => formatUsageBucketLabel(value, granularity)}
						valueFormatter={showCost ? formatUsd : undefined}
						series={tokensChart.series}
						showLegend={tokensChart.showLegend}
						titleAccessory={
							<Select
								value={tokenView}
								onValueChange={(value) => onUpdateSearch({ tokenView: value as TokenChartDisplayMode })}
							>
								<SelectTrigger size='sm' variant='ghost' className={styles.tokenViewTrigger}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{tokenChartDisplayOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						}
					/>
				</div>
			)}
		</div>
	);
}

function buildMessagesBySourceChart(chartData: UsageRecord[]): UsageChart {
	const activeMessageSeries = messageSeries.filter(({ data_key }) =>
		chartData.some((record) => record[data_key] > 0),
	);
	const series = activeMessageSeries.length > 0 ? activeMessageSeries : [...messageSeries];

	return {
		data: chartData,
		series,
		showLegend: series.some(({ data_key }) => data_key !== 'webMessageCount'),
	};
}

function formatUsd(value: number): string {
	const abs = Math.abs(value);

	if (abs >= 10_000) {
		return `${value < 0 ? '-' : ''}$${formatCompactCurrency(Math.abs(value))}`;
	}

	if (abs > 0 && abs < 0.01) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 4,
			maximumFractionDigits: 4,
		}).format(value);
	}

	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: abs === 0 ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function formatCompactCurrency(value: number): string {
	if (value >= 1_000_000_000) {
		return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
	}
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
	}
	return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
}
