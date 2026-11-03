import * as React from 'react';
import type { LegendProps, Tooltip } from 'recharts';
import type { Payload } from 'recharts/types/component/DefaultLegendContent';

import { formatPercentShare, sumPercentStackBase } from './chart-builder';
import { CHART_NUMBER_LOCALE, formatChartValue } from './chart-values';
import { type ClassNameMerger, joinClassNames } from './class-names';
import type * as displayChart from './tools/display-chart';

export const CHART_THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
	[k in string]: {
		label?: React.ReactNode;
		icon?: React.ComponentType;
		isTotal?: boolean;
		valueFormat?: displayChart.ValueFormat;
	} & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof CHART_THEMES, string> });
};

interface ChartContextProps {
	config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

export function ChartConfigProvider({ config, children }: { config: ChartConfig; children: React.ReactNode }) {
	const value = React.useMemo(() => ({ config }), [config]);
	return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

export function useChart(): ChartContextProps {
	const context = React.useContext(ChartContext);

	if (!context) {
		throw new Error('useChart must be used within a <ChartConfigProvider />');
	}

	return context;
}

type TooltipContentProps = React.ComponentProps<typeof Tooltip> &
	React.ComponentProps<'div'> & {
		hideLabel?: boolean;
		hideIndicator?: boolean;
		indicator?: 'line' | 'dot' | 'dashed';
		nameKey?: string;
		labelKey?: string;
		percent?: boolean;
		valueFormatter?: (value: number) => string;
		isDualAxis?: boolean;
		hideTotal?: boolean;
		cn?: ClassNameMerger;
	};

/** `loopwise-chart-tooltip__*` classes let sandboxed custom stories style the same markup. */
export function ChartTooltipContent({
	active,
	payload,
	className,
	indicator = 'dot',
	hideLabel = false,
	hideIndicator = false,
	label,
	labelFormatter,
	labelClassName,
	formatter,
	color,
	nameKey,
	labelKey,
	percent = false,
	valueFormatter,
	isDualAxis = false,
	hideTotal = false,
	cn = joinClassNames,
}: TooltipContentProps) {
	const { config } = useChart();

	const tooltipLabel = React.useMemo(() => {
		if (hideLabel || !payload?.length) {
			return null;
		}

		const [item] = payload;
		const key = `${labelKey || item?.dataKey || item?.name || 'value'}`;
		const itemConfig = getPayloadConfigFromPayload(config, item, key);
		const isAxisValue = !labelKey && (typeof label === 'string' || typeof label === 'number');
		const value = isAxisValue ? config[String(label)]?.label || label : itemConfig?.label;
		const labelClasses = cn('loopwise-shared-labelclasses-2689f3 loopwise-chart-tooltip__label', labelClassName);

		if (labelFormatter) {
			return <div className={labelClasses}>{labelFormatter(value, payload)}</div>;
		}

		if (value === undefined || value === null || value === '') {
			return null;
		}

		return <div className={labelClasses}>{value}</div>;
	}, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey, cn]);

	if (!active || !payload?.length) {
		return null;
	}

	const nestLabel = payload.length === 1 && indicator !== 'dot';

	const visiblePayload = payload.filter((item) => item.type !== 'none');
	const isTotalItem = (item: (typeof visiblePayload)[number]) => {
		const key = `${nameKey || item.name || item.dataKey || 'value'}`;
		return getPayloadConfigFromPayload(config, item, key)?.isTotal === true;
	};
	const numericValues = visiblePayload.map((item) => item.value).filter((v): v is number => typeof v === 'number');
	const hasTotalSeries = visiblePayload.some(isTotalItem);
	const seriesTotal = numericValues.reduce((sum, v) => sum + v, 0);
	// 100% shares are relative to the stacked (non-total) series only, so each category sums to 100%.
	const shareBase = sumPercentStackBase(
		visiblePayload
			.filter((item) => typeof item.value === 'number')
			.map((item) => ({ value: item.value as number, isTotal: isTotalItem(item) })),
	);
	// In 100% stacked mode every category totals 100%, so ignore already-aggregated total series.
	const showTotal = !isDualAxis && numericValues.length > 1 && (percent || (!hasTotalSeries && !hideTotal));
	const firstItem = visiblePayload[0];
	const firstItemKey = `${nameKey || firstItem?.name || firstItem?.dataKey || 'value'}`;
	const firstItemFormat = getPayloadConfigFromPayload(config, firstItem, firstItemKey)?.valueFormat;

	return (
		<div className={cn('loopwise-shared-charttooltipcontentdiv-24a33e loopwise-chart-tooltip', className)}>
			{!nestLabel ? tooltipLabel : null}
			<div className='loopwise-shared-charttooltipcontentdiv-c7bd35 loopwise-chart-tooltip__items'>
				{visiblePayload.map((item, index) => {
					const key = `${nameKey || item.name || item.dataKey || 'value'}`;
					const itemConfig = getPayloadConfigFromPayload(config, item, key);
					const indicatorColor = color || item.payload.fill || item.color;

					return (
						<div
							key={item.dataKey}
							className={cn(
								'loopwise-shared-charttooltipcontentdiv-f0192d loopwise-chart-tooltip__item',
								indicator === 'dot' && 'loopwise-shared-charttooltipcontentdiv-3960ff',
							)}
						>
							{formatter && item?.value !== undefined && item.name ? (
								formatter(item.value, item.name, item, index, item.payload)
							) : (
								<>
									{itemConfig?.icon ? (
										<itemConfig.icon />
									) : (
										!hideIndicator && (
											<div
												className={cn(
													`loopwise-chart-tooltip__indicator loopwise-chart-tooltip__indicator--${indicator} loopwise-chart-tooltip__indicator-layout`,
													{
														'loopwise-shared-charttooltipcontentdiv-315860':
															indicator === 'dot',
														'loopwise-shared-charttooltipcontentdiv-0b0057':
															indicator === 'line',
														'loopwise-shared-charttooltipcontentdiv-c4f2ae':
															indicator === 'dashed',
														'loopwise-shared-charttooltipcontentdiv-7bd3b5':
															nestLabel && indicator === 'dashed',
													},
												)}
												style={
													{
														'--color-bg': indicatorColor,
														'--color-border': indicatorColor,
													} as React.CSSProperties
												}
											/>
										)
									)}
									<div
										className={cn(
											'loopwise-shared-charttooltipcontentdiv-72d25d loopwise-chart-tooltip__row',
											nestLabel
												? 'loopwise-shared-charttooltipcontentdiv-6f27f4'
												: 'loopwise-shared-charttooltipcontentdiv-3960ff',
										)}
									>
										<div className='loopwise-shared-charttooltipcontentdiv-c7bd35'>
											{nestLabel ? tooltipLabel : null}
											<span className='loopwise-shared-charttooltipcontentspan-bfa603 loopwise-chart-tooltip__name'>
												{itemConfig?.label || item.name}
											</span>
										</div>
										{item.value !== undefined && item.value !== null && (
											<span className='loopwise-shared-charttooltipcontentspan-40f631 loopwise-chart-tooltip__value'>
												{formatTooltipValue(item.value, {
													percent,
													shareBase,
													valueFormatter,
													valueFormat: itemConfig?.valueFormat,
												})}
											</span>
										)}
									</div>
								</>
							)}
						</div>
					);
				})}
				{showTotal && (
					<div className='loopwise-shared-charttooltipcontentdiv-1a8d63 loopwise-chart-tooltip__total'>
						<div className='loopwise-shared-charttooltipcontentdiv-d70e83 loopwise-chart-tooltip__row'>
							<span className='loopwise-shared-charttooltipcontentspan-5963c2 loopwise-chart-tooltip__name'>
								Total
							</span>
							<span className='loopwise-shared-charttooltipcontentspan-40f631 loopwise-chart-tooltip__value'>
								{percent
									? '100%'
									: valueFormatter
										? valueFormatter(seriesTotal)
										: formatChartValue(seriesTotal, firstItemFormat, { compact: true })}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

type LegendContentProps = React.ComponentProps<'div'> &
	Pick<LegendProps, 'verticalAlign' | 'layout' | 'align'> & {
		hideIcon?: boolean;
		nameKey?: string;
		onItemClick?: (dataKey: string) => void;
		payload?: (Payload & { isHidden?: boolean })[];
		cn?: ClassNameMerger;
	};

/** `loopwise-chart-legend__*` classes let sandboxed custom stories style the same markup. */
export function ChartLegendContent({
	className,
	hideIcon = false,
	payload,
	verticalAlign = 'bottom',
	layout = 'horizontal',
	align = 'center',
	nameKey,
	onItemClick,
	cn = joinClassNames,
}: LegendContentProps) {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	const isVertical = layout === 'vertical';

	return (
		<div
			className={cn(
				'loopwise-shared-chartlegendcontentdiv-1b314c loopwise-chart-legend',
				isVertical
					? 'loopwise-shared-chartlegendcontentdiv-446d83'
					: cn(
							'loopwise-shared-chartlegendcontentdiv-bc3c5d',
							align === 'right'
								? 'loopwise-shared-chartlegendcontentdiv-77c08e'
								: align === 'left'
									? 'loopwise-shared-chartlegendcontentdiv-4b5cc1'
									: 'loopwise-shared-chartlegendcontentdiv-86843c',
							verticalAlign === 'top'
								? 'loopwise-shared-chartlegendcontentdiv-7fcf91'
								: 'loopwise-shared-chartlegendcontentdiv-ce335a',
						),
				className,
			)}
		>
			{payload
				.filter((item) => item.type !== 'none')
				.map((item) => {
					const key = `${nameKey || item.dataKey || 'value'}`;
					const itemConfig = getPayloadConfigFromPayload(config, item, key);
					const dataKey = String(item.dataKey);

					return (
						<div
							key={item.value}
							className={cn(
								'loopwise-shared-chartlegendcontentdiv-e898c8 loopwise-chart-legend__item',
								onItemClick &&
									'loopwise-shared-chartlegendcontentdiv-b18edd loopwise-chart-legend__item--clickable',
								item.isHidden &&
									'loopwise-shared-chartlegendcontentdiv-2a2db4 loopwise-chart-legend__item--hidden',
							)}
							onClick={() => onItemClick?.(dataKey)}
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className='loopwise-shared-chartlegendcontentdiv-b72f31 loopwise-chart-legend__swatch'
									style={{ backgroundColor: item.color }}
								/>
							)}
							{itemConfig?.label}
						</div>
					);
				})}
		</div>
	);
}

interface TooltipValueOptions {
	percent: boolean;
	shareBase: number;
	valueFormatter?: (value: number) => string;
	valueFormat?: displayChart.ValueFormat;
}

function formatTooltipValue(value: unknown, { percent, shareBase, valueFormatter, valueFormat }: TooltipValueOptions) {
	if (typeof value !== 'number') {
		return (value as { toLocaleString: (locale: string) => string }).toLocaleString(CHART_NUMBER_LOCALE);
	}
	if (percent) {
		return formatPercentShare(value, shareBase);
	}
	return valueFormatter ? valueFormatter(value) : formatChartValue(value, valueFormat, { compact: true });
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
	if (typeof payload !== 'object' || payload === null) {
		return undefined;
	}

	const payloadPayload =
		'payload' in payload && typeof payload.payload === 'object' && payload.payload !== null
			? payload.payload
			: undefined;

	let configLabelKey: string = key;

	if (key in payload && typeof payload[key as keyof typeof payload] === 'string') {
		configLabelKey = payload[key as keyof typeof payload] as string;
	} else if (
		payloadPayload &&
		key in payloadPayload &&
		typeof payloadPayload[key as keyof typeof payloadPayload] === 'string'
	) {
		configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
	}

	return configLabelKey in config ? config[configLabelKey] : config[key];
}
