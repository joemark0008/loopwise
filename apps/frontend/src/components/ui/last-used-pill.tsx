import styles from './last-used-pill.module.css';
import { cn } from '@/lib/utils';

export function LastUsedPill({ className }: { className?: string }) {
	return <span className={cn(styles.lastUsedPillSpan, styles.lastUsedPillSpan2, className)}>Last used</span>;
}
