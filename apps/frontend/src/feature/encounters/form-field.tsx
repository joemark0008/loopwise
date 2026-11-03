import { useId } from 'react';
import styles from './encounter.module.css';
import type { ReactNode } from 'react';

/** A labelled control of the encounter forms; `children` gets the id for the control. */
export function FormField({
	label,
	unit,
	error,
	wide,
	children,
}: {
	label: string;
	unit?: string;
	error?: string;
	wide?: boolean;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<div className={styles.field} data-wide={wide || undefined}>
			<label htmlFor={id} className={styles.fieldLabel}>
				{label}
				{unit && <span className={styles.fieldUnit}> ({unit})</span>}
			</label>
			{children(id)}
			{error && <p className={styles.fieldError}>{error}</p>}
		</div>
	);
}
