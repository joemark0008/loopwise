import { Switch as MantineSwitch } from '@mantine/core';

import styles from './switch.module.css';
import { cn } from '@/lib/utils';

const trackClassName = styles.trackClassName;

function SwitchThumb({ checked }: { checked: boolean }) {
	return (
		<>
			<span
				aria-hidden='true'
				className={cn(styles.switchThumbSpan, checked ? styles.switchThumbSpan2 : styles.switchThumbSpan3)}
			/>
			<span
				className={cn(styles.switchThumbSpan4, checked ? styles.switchThumbSpan5 : styles.switchThumbSpan6)}
			/>
		</>
	);
}

interface SwitchProps {
	checked: boolean;
	onCheckedChange?: (checked: boolean) => void;
	disabled?: boolean;
	id?: string;
	className?: string;
	'aria-label'?: string;
	'aria-labelledby'?: string;
}

export function Switch({
	checked,
	onCheckedChange,
	disabled,
	id,
	className,
	'aria-label': ariaLabel,
	'aria-labelledby': ariaLabelledby,
}: SwitchProps) {
	return (
		<MantineSwitch
			id={id}
			size='sm'
			withThumbIndicator={false}
			checked={checked}
			disabled={disabled}
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledby}
			className={className}
			onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
		/>
	);
}

export function SwitchIndicator({ checked, className }: { checked: boolean; className?: string }) {
	return (
		<span aria-hidden='true' className={cn(trackClassName, className)}>
			<SwitchThumb checked={checked} />
		</span>
	);
}
