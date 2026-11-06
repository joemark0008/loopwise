import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDigit } from 'lucide-react';
import { useState } from 'react';
import styles from './billing.module.css';
import { useIsBillingAdmin } from './cashier-page';
import type { InvoiceSeriesState } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

const STATE_LABELS: Record<InvoiceSeriesState, string> = {
	ACTIVE: 'In use',
	EXHAUSTED: 'Used up',
	EXPIRED: 'Expired',
	INACTIVE: 'Turned off',
};

const EMPTY_FORM = { prefix: 'SI-', startNo: '', endNo: '', permitNo: '', permitDate: '', validUntil: '' };

/**
 * The clinic's BIR invoice series (ATP or CAS / PTU permit and its numbered range). Issuing takes the next number of
 * the first usable series and is refused once every series is used up or expired. Clinic admins register a series and
 * turn one off; the billing desk sees what is left.
 */
export function InvoiceSeriesTab() {
	const queryClient = useQueryClient();
	const isAdmin = useIsBillingAdmin();
	const [form, setForm] = useState(EMPTY_FORM);
	const series = useQuery(billingApi.billing.series.queryOptions(undefined));
	const refresh = { onSuccess: () => queryClient.invalidateQueries(billingApi.invalidate) };
	const create = useMutation(
		billingApi.billing.createSeries.mutationOptions({
			onSuccess: () => {
				setForm(EMPTY_FORM);
				void queryClient.invalidateQueries(billingApi.invalidate);
			},
		}),
	);
	const update = useMutation(billingApi.billing.updateSeries.mutationOptions(refresh));
	const valid =
		Number(form.startNo) > 0 &&
		Number(form.endNo) >= Number(form.startNo) &&
		form.permitNo.trim().length > 0 &&
		/^\d{4}-\d{2}-\d{2}$/.test(form.permitDate);

	return (
		<PageSection title='Invoice series' meta={series.data ? String(series.data.length) : undefined}>
			{series.isPending ? (
				<Skeleton />
			) : series.error ? (
				<ErrorMessage message={series.error.message} />
			) : series.data.length === 0 ? (
				<EmptyState icon={FileDigit} title='No BIR series registered'>
					Until one is, invoices are numbered from the clinic’s INVOICE sequence (Settings → Clinic →
					Numbering).
				</EmptyState>
			) : (
				<div className={styles.tableScroll}>
					<table className={styles.table} data-testid='invoice-series'>
						<thead>
							<tr>
								<th scope='col'>Range</th>
								<th scope='col'>Permit</th>
								<th scope='col'>Valid until</th>
								<th scope='col' data-numeric>
									Next
								</th>
								<th scope='col' data-numeric>
									Left
								</th>
								<th scope='col'>State</th>
								{isAdmin && (
									<th scope='col'>
										<span className='sr-only'>Actions</span>
									</th>
								)}
							</tr>
						</thead>
						<tbody>
							{series.data.map((row) => (
								<tr key={row.id}>
									<td>
										{row.prefix ?? ''}
										{row.startNo}–{row.endNo}
									</td>
									<td>
										{row.permitNo ?? '—'}
										{row.permitDate ? ` · ${row.permitDate}` : ''}
									</td>
									<td>{row.validUntil ?? 'No expiry'}</td>
									<td data-numeric>{row.nextNo}</td>
									<td data-numeric>{row.remaining}</td>
									<td>{STATE_LABELS[row.state]}</td>
									{isAdmin && (
										<td>
											<Button
												size='sm'
												variant='ghost-muted'
												disabled={update.isPending}
												onClick={() => update.mutate({ id: row.id, isActive: !row.isActive })}
											>
												{row.isActive ? 'Turn off' : 'Turn on'}
											</Button>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{isAdmin && (
				<form
					className={styles.paymentForm}
					aria-label='New series'
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate({
							prefix: form.prefix.trim() || null,
							startNo: Number(form.startNo),
							endNo: Number(form.endNo),
							permitNo: form.permitNo.trim(),
							permitDate: form.permitDate,
							validUntil: form.validUntil || null,
						});
					}}
				>
					<div className={styles.fields}>
						{(
							[
								['prefix', 'Prefix', 'text'],
								['startNo', 'First number', 'number'],
								['endNo', 'Last number', 'number'],
								['permitNo', 'ATP / CAS permit no.', 'text'],
								['permitDate', 'Permit date', 'date'],
								['validUntil', 'Valid until (optional)', 'date'],
							] as const
						).map(([key, label, type]) => (
							<FormField key={key} label={label}>
								{(id) => (
									<Input
										id={id}
										type={type}
										value={form[key]}
										onChange={(event) => setForm({ ...form, [key]: event.target.value })}
										disabled={create.isPending}
									/>
								)}
							</FormField>
						))}
					</div>
					<div className={styles.actions}>
						<Button type='submit' disabled={!valid || create.isPending}>
							Register series
						</Button>
					</div>
				</form>
			)}
			{(create.error ?? update.error) && <ErrorMessage message={(create.error ?? update.error)!.message} />}
		</PageSection>
	);
}
