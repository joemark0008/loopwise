import styles from './clinical.module.css';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** An empty list or a screen still to come: what goes here, and the next step. */
export function EmptyState({
	icon: Icon,
	title,
	children,
	action,
}: {
	icon?: LucideIcon;
	title: string;
	children?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className={styles.emptyState} role='status'>
			{Icon && <Icon aria-hidden />}
			<p className={styles.emptyTitle}>{title}</p>
			{children && <p className={styles.emptyBody}>{children}</p>}
			{action}
		</div>
	);
}
