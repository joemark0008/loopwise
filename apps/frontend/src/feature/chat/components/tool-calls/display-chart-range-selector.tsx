import styles from './display-chart-range-selector.module.css';
import type { RangeOptions } from '@/lib/charts.utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props<T extends RangeOptions> {
	selectedRange: keyof T;
	options: T;
	onRangeSelected: (range: keyof T) => void;
}

export function ChartRangeSelector<T extends RangeOptions>({ options, selectedRange, onRangeSelected }: Props<T>) {
	return (
		<Select value={selectedRange as string} onValueChange={(v) => onRangeSelected(v as keyof T)}>
			<SelectTrigger className={styles.chartRangeSelectorSelectTrigger}>
				<SelectValue>{options[selectedRange].label}</SelectValue>
			</SelectTrigger>

			<SelectContent align='center' position='item-aligned' className={styles.chartRangeSelectorSelectContent}>
				{Object.entries(options).map(([key, value]) => (
					<SelectItem key={key} value={key}>
						{value.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
