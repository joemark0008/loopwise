import styles from './clinical.module.css';
import type { ReactNode } from 'react';

/** A form's actions: secondary and destructive ones at the start, the primary action last, on the right. */
export function ActionBar({ start, children }: { start?: ReactNode; children: ReactNode }) {
	return (
		<div className={styles.actionBar}>
			{start && <div className={styles.actionBarStart}>{start}</div>}
			{children}
		</div>
	);
}
