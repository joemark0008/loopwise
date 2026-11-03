import styles from './locked-fieldset.module.css';
import { cn } from '@/lib/utils';

interface LockedFieldsetProps {
	disabled: boolean;
	children: React.ReactNode;
	className?: string;
}

export function LockedFieldset({ disabled, children, className }: LockedFieldsetProps) {
	return (
		<fieldset
			disabled={disabled}
			className={cn(styles.lockedFieldsetFieldset, className, disabled && styles.lockedFieldsetFieldset2)}
			aria-disabled={disabled}
		>
			{children}
		</fieldset>
	);
}
