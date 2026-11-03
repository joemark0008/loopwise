import styles from './page.module.css';
import type { ReactNode } from 'react';

/** A screen's h1 and its primary actions (one primary per screen). */
export function PageHeader({
	title,
	subtitle,
	actions,
}: {
	title: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className={styles.header}>
			<div>
				<h1 className={styles.title}>{title}</h1>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			{actions && <div className={styles.actions}>{actions}</div>}
		</header>
	);
}

/** A titled card on a clinical screen. */
export function PageSection({
	title,
	meta,
	children,
	labelledBy,
}: {
	title: string;
	meta?: ReactNode;
	children: ReactNode;
	labelledBy?: string;
}) {
	const id = labelledBy ?? `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
	return (
		<section className={styles.section} aria-labelledby={id}>
			<div className={styles.sectionHeader}>
				<h2 id={id} className={styles.sectionTitle}>
					{title}
				</h2>
				{meta && <span className={styles.sectionMeta}>{meta}</span>}
			</div>
			{children}
		</section>
	);
}
