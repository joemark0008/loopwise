import { useQuery } from '@tanstack/react-query';
import { formatPesos } from '@loopwise/shared/invoice';
import { History } from 'lucide-react';
import { useState } from 'react';
import styles from './billing.module.css';
import { ShiftFigures } from './shift-panel';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

/** Today in Manila (YYYY-MM-DD). */
export const manilaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

/** The clinic's shifts of a period with their X / Z figures (admins see every cashier's, a cashier their own). */
export function ShiftsTab() {
	const [from, setFrom] = useState(() => manilaToday());
	const [to, setTo] = useState(() => manilaToday());
	const shifts = useQuery(billingApi.billing.shifts.queryOptions({ from, to: to || null }));
	return (
		<PageSection title='Shifts' meta={shifts.data ? String(shifts.data.length) : undefined}>
			<div className={styles.toolbar}>
				<FormField label='From'>
					{(id) => (
						<Input id={id} type='date' value={from} onChange={(event) => setFrom(event.target.value)} />
					)}
				</FormField>
				<FormField label='To'>
					{(id) => <Input id={id} type='date' value={to} onChange={(event) => setTo(event.target.value)} />}
				</FormField>
			</div>
			{shifts.isPending ? (
				<Skeleton />
			) : shifts.error ? (
				<ErrorMessage message={shifts.error.message} />
			) : shifts.data.length === 0 ? (
				<EmptyState icon={History} title='No shifts in this period' />
			) : (
				<div className={styles.desk}>
					{shifts.data.map((shift) => (
						<article key={shift.id} className={styles.panel} data-testid='shift-history'>
							<div className={styles.panelHeader}>
								<h3 className={styles.panelTitle}>{shift.cashierName}</h3>
								<span className={styles.muted}>
									{formatDateTime(shift.openedAt)}
									{shift.closedAt ? ` – ${formatDateTime(shift.closedAt)}` : ' · open'}
								</span>
							</div>
							<ShiftFigures shift={shift} />
							{shift.denominations.length > 0 && (
								<p className={styles.muted}>
									Counted:{' '}
									{shift.denominations
										.map((row) => `${row.count} × ${formatPesos(row.denomination)}`)
										.join(', ')}
								</p>
							)}
							{shift.remarks && <p className={styles.muted}>{shift.remarks}</p>}
						</article>
					))}
				</div>
			)}
		</PageSection>
	);
}
