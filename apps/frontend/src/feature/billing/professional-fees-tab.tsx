import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPesos } from '@loopwise/shared/invoice';
import { Stethoscope } from 'lucide-react';
import { useState } from 'react';
import styles from './billing.module.css';
import { useIsBillingAdmin } from './cashier-page';
import { manilaToday } from './shifts-tab';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

const firstOfMonth = () => `${manilaToday().slice(0, 8)}01`;

const PF_STATUS_LABELS: Record<string, string> = {
	UNPAID: 'Unpaid',
	FOR_RELEASE: 'For release',
	RELEASED: 'Released',
	CANCELLED: 'Cancelled',
};

/**
 * Doctors' professional fees of a period, by doctor: gross (net of VAT, after discounts), the clinic's share, the
 * expanded withholding tax (BIR 2307) and the net payable. Admins tick unreleased fees and release them with the check
 * or transfer reference.
 */
export function ProfessionalFeesTab() {
	const queryClient = useQueryClient();
	const isAdmin = useIsBillingAdmin();
	const [from, setFrom] = useState(firstOfMonth);
	const [to, setTo] = useState(manilaToday);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [releaseRef, setReleaseRef] = useState('');
	const report = useQuery(billingApi.billing.feeReport.queryOptions({ from, to: to || null }));
	const release = useMutation(
		billingApi.billing.releaseFees.mutationOptions({
			onSuccess: () => {
				setSelected(new Set());
				setReleaseRef('');
				void queryClient.invalidateQueries(billingApi.invalidate);
			},
		}),
	);
	const toggle = (id: string) => {
		const next = new Set(selected);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelected(next);
	};

	return (
		<PageSection title='Professional fees' meta={report.data ? formatPesos(report.data.netPayable) : undefined}>
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
			{report.isPending ? (
				<Skeleton />
			) : report.error ? (
				<ErrorMessage message={report.error.message} />
			) : report.data.doctors.length === 0 ? (
				<EmptyState icon={Stethoscope} title='No professional fees in this period'>
					A doctor’s fee is recorded when an invoice with their consultation or fee is issued.
				</EmptyState>
			) : (
				<>
					{report.data.doctors.map((doctor) => (
						<div key={doctor.practitionerId} className={styles.tableScroll} data-testid='pf-doctor'>
							<table className={styles.table}>
								<caption className={styles.panelTitle}>
									{doctor.name}
									{doctor.tin ? ` · TIN ${doctor.tin}` : ''}
								</caption>
								<thead>
									<tr>
										{isAdmin && (
											<th scope='col'>
												<span className='sr-only'>Release</span>
											</th>
										)}
										<th scope='col'>Invoice</th>
										<th scope='col'>Date</th>
										<th scope='col' data-numeric>
											Gross
										</th>
										<th scope='col' data-numeric>
											Clinic share
										</th>
										<th scope='col' data-numeric>
											EWT
										</th>
										<th scope='col' data-numeric>
											Net payable
										</th>
										<th scope='col'>Status</th>
									</tr>
								</thead>
								<tbody>
									{doctor.fees.map((fee) => {
										const releasable = fee.status === 'UNPAID' || fee.status === 'FOR_RELEASE';
										return (
											<tr key={fee.id}>
												{isAdmin && (
													<td>
														{releasable && (
															<Checkbox
																checked={selected.has(fee.id)}
																onCheckedChange={() => toggle(fee.id)}
																aria-label={`Release the fee of ${fee.invoiceNo ?? 'this invoice'}`}
															/>
														)}
													</td>
												)}
												<td>{fee.invoiceNo ?? '—'}</td>
												<td>
													{fee.invoiceDate ? formatDay(fee.invoiceDate.slice(0, 10)) : '—'}
												</td>
												<td data-numeric>{formatPesos(fee.grossAmount)}</td>
												<td data-numeric>{formatPesos(fee.clinicShare)}</td>
												<td data-numeric>
													{formatPesos(fee.ewtAmount)} ({Math.round(fee.ewtRate * 1000) / 10}
													%)
												</td>
												<td data-numeric>{formatPesos(fee.netPayable)}</td>
												<td>
													{PF_STATUS_LABELS[fee.status] ?? fee.status}
													{fee.releaseRef ? ` · ${fee.releaseRef}` : ''}
												</td>
											</tr>
										);
									})}
								</tbody>
								<tfoot>
									<tr>
										{isAdmin && <td />}
										<td colSpan={2}>Total ({doctor.count})</td>
										<td data-numeric>{formatPesos(doctor.grossAmount)}</td>
										<td data-numeric>{formatPesos(doctor.clinicShare)}</td>
										<td data-numeric>{formatPesos(doctor.ewtAmount)}</td>
										<td data-numeric>{formatPesos(doctor.netPayable)}</td>
										<td>Unreleased {formatPesos(doctor.unreleased)}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					))}
					{isAdmin && (
						<form
							className={styles.toolbar}
							onSubmit={(event) => {
								event.preventDefault();
								release.mutate({ ids: [...selected], releaseRef: releaseRef.trim() });
							}}
						>
							<FormField label='Check or transfer reference'>
								{(id) => (
									<Input
										id={id}
										value={releaseRef}
										onChange={(event) => setReleaseRef(event.target.value)}
										disabled={release.isPending}
									/>
								)}
							</FormField>
							<Button
								type='submit'
								disabled={selected.size === 0 || releaseRef.trim().length < 2 || release.isPending}
							>
								Release{' '}
								{selected.size > 0 ? `${selected.size} fee${selected.size === 1 ? '' : 's'}` : 'fees'}
							</Button>
						</form>
					)}
					{release.error && <ErrorMessage message={release.error.message} />}
				</>
			)}
		</PageSection>
	);
}
