import { useId } from 'react';
import styles from './clinic-setup.module.css';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';

/** A labelled control of the clinic setup forms; `children` gets the id for the control. */
export function Field({
	label,
	hint,
	error,
	required,
	wide,
	children,
}: {
	label: string;
	hint?: string;
	error?: string;
	required?: boolean;
	wide?: boolean;
	children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const errorId = error ? `${id}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
	return (
		<div className={styles.field} data-wide={wide || undefined}>
			<label htmlFor={id} className={styles.fieldLabel}>
				{label}
				{required && (
					<span className={styles.required} aria-hidden>
						{' '}
						*
					</span>
				)}
			</label>
			{children(id, describedBy)}
			{hint && (
				<p id={hintId} className={styles.hint}>
					{hint}
				</p>
			)}
			{error && (
				<p id={errorId} className={styles.fieldError}>
					{error}
				</p>
			)}
		</div>
	);
}

/** A load failure: the reason and a retry button (docs/frontend-design.md §9, required states). */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div className={styles.form} role='alert'>
			<ErrorMessage message={message} />
			<div className={styles.actions}>
				<Button type='button' size='sm' variant='outline' onClick={onRetry}>
					Retry
				</Button>
			</div>
		</div>
	);
}

/** A form value as the API takes it: trimmed, null when empty. */
export const orNull = (value: string): string | null => value.trim() || null;

/** A number field's value, or null when empty. */
export function numberOrNull(value: string): number | null {
	if (!value.trim()) {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const peso = (value: number | null | undefined): string => (value == null ? '—' : PESO.format(value));

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MANILA = 'Asia/Manila';

/** "Tue 17 Nov 2026, 09:00" in Philippine time. */
export function manilaDateTime(iso: string): string {
	return new Intl.DateTimeFormat('en-PH', {
		timeZone: MANILA,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(new Date(iso));
}

/** "17 Nov 2026" of a `YYYY-MM-DD`. */
export function calendarDate(date: string): string {
	return new Intl.DateTimeFormat('en-PH', {
		timeZone: 'UTC',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
	}).format(new Date(`${date}T00:00:00Z`));
}

/** Today's date in the Philippines, `YYYY-MM-DD`. */
export function manilaToday(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA }).format(new Date());
}
