import styles from './icon-segmented-toggle.module.css';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface IconSegmentedToggleOption<Value extends string> {
	value: Value;
	label: string;
	icon?: LucideIcon;
}

interface IconSegmentedToggleProps<Value extends string> {
	options: readonly IconSegmentedToggleOption<Value>[];
	value: Value;
	onValueChange: (value: Value) => void;
	disabled?: boolean;
	className?: string;
	showLabels?: boolean;
	showIcons?: boolean;
}

export function IconSegmentedToggle<Value extends string>({
	options,
	value,
	onValueChange,
	disabled = false,
	className,
	showLabels = false,
	showIcons = true,
}: IconSegmentedToggleProps<Value>) {
	return (
		<div className={cn(styles.iconSegmentedToggleDiv, className)}>
			{options.map(({ value: option, label, icon: Icon }) => {
				const button = (
					<Button
						key={option}
						type='button'
						variant='ghost'
						className={cn(
							showLabels ? styles.buttonButton : styles.buttonButton2,
							value === option && styles.buttonButton3,
							styles.buttonButton4,
						)}
						onClick={() => onValueChange(option)}
						disabled={disabled}
						aria-label={label}
						aria-pressed={value === option}
					>
						{showIcons && Icon && <Icon className={styles.buttonIcon} strokeWidth={2.25} />}
						{showLabels && <span className={styles.buttonSpan}>{label}</span>}
					</Button>
				);
				return showLabels ? (
					button
				) : (
					<SimpleTooltip key={option} content={label}>
						{button}
					</SimpleTooltip>
				);
			})}
		</div>
	);
}
