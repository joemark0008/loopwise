import {
	ChartArea,
	ChartBarStacked,
	ChartColumn,
	ChartColumnStacked,
	ChartLine,
	ChartNoAxesCombined,
	ChartPie,
	ChartScatter,
	SquareSigma,
} from 'lucide-react';
import styles from './chart-type-picker.module.css';
import type { ChartType } from '@loopwise/shared/chart-types';
import type { ComponentType } from 'react';
import ChartDonutIcon from '@/components/icons/chart-donut.svg';
import ChartRadarIcon from '@/components/icons/chart-radar.svg';
import ChartStackedAreaIcon from '@/components/icons/chart-stacked-area.svg';

import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ChartTypeOption {
	value: ChartType;
	label: string;
	icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
	{ value: 'bar', label: 'Bar', icon: ChartColumn },
	{ value: 'stacked_bar', label: 'Stacked bar', icon: ChartColumnStacked },
	{ value: 'horizontal_bar', label: 'Horizontal bar', icon: ChartBarStacked },
	{ value: 'line', label: 'Line', icon: ChartLine },
	{ value: 'area', label: 'Area', icon: ChartArea },
	{ value: 'stacked_area', label: 'Stacked area', icon: ChartStackedAreaIcon },
	{ value: 'mixed', label: 'Mixed', icon: ChartNoAxesCombined },
	{ value: 'pie', label: 'Pie', icon: ChartPie },
	{ value: 'donut', label: 'Donut', icon: ChartDonutIcon },
	{ value: 'kpi_card', label: 'KPI card', icon: SquareSigma },
	{ value: 'scatter', label: 'Scatter', icon: ChartScatter },
	{ value: 'radar', label: 'Radar', icon: ChartRadarIcon },
];

interface ChartTypePickerProps {
	value: ChartType;
	onValueChange: (value: ChartType) => void;
	className?: string;
}

export function ChartTypePicker({ value, onValueChange, className }: ChartTypePickerProps) {
	return (
		<div role='group' aria-label='Chart type' className={cn(styles.chartTypePickerDiv, className)}>
			{CHART_TYPE_OPTIONS.map(({ value: option, label, icon: Icon }) => {
				const isSelected = value === option;
				return (
					<SimpleTooltip key={option} content={label}>
						<button
							type='button'
							aria-pressed={isSelected}
							aria-label={label}
							onClick={() => onValueChange(option)}
							className={cn(
								styles.chartTypePickerButton,
								styles.chartTypePickerButton2,
								isSelected && styles.chartTypePickerButton3,
							)}
						>
							<Icon className={styles.chartTypePickerIcon} strokeWidth={1.75} />
						</button>
					</SimpleTooltip>
				);
			})}
		</div>
	);
}

export function chartTypeLabel(value: ChartType): string | undefined {
	return CHART_TYPE_OPTIONS.find((option) => option.value === value)?.label;
}
