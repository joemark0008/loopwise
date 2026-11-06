import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pill } from 'lucide-react';
import { useState } from 'react';
import styles from './pharmacy.module.css';
import { qty } from './pharmacy-format';
import type { DispenseEntry } from '@/lib/pharmacy-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { pharmacyApi } from '@/lib/pharmacy-api';

export const DISPENSE_STATUS: Record<
	DispenseEntry['status'],
	{ tone: 'info' | 'abnormal' | 'done' | 'void'; label: string }
> = {
	ACTIVE: { tone: 'info', label: 'To dispense' },
	PARTIALLY_DISPENSED: { tone: 'abnormal', label: 'Partly dispensed' },
	DISPENSED: { tone: 'done', label: 'Dispensed' },
	CANCELLED: { tone: 'void', label: 'Cancelled' },
	EXPIRED: { tone: 'void', label: 'Expired' },
};

/** Pharmacy → Dispense: the clinic's issued prescriptions still to dispense, oldest first. */
export function DispenseQueuePage() {
	const [includeDone, setIncludeDone] = useState(false);
	const queue = useQuery(pharmacyApi.queue.queryOptions({ includeDone }));
	return (
		<PageSection title='Prescriptions to dispense' meta={queue.data ? String(queue.data.length) : undefined}>
			<div className={styles.toolbar}>
				<label className={styles.checkboxRow}>
					<Checkbox checked={includeDone} onCheckedChange={setIncludeDone} />
					Also show those dispensed in the last 7 days
				</label>
			</div>
			{queue.isPending ? (
				<Skeleton />
			) : queue.error ? (
				<ErrorMessage message={queue.error.message} />
			) : queue.data.length === 0 ? (
				<EmptyState icon={Pill} title='Nothing to dispense'>
					Prescriptions the clinic's doctors issue arrive here.
				</EmptyState>
			) : (
				<div className={pageStyles.tableScroll}>
					<table className={pageStyles.table} data-reflow data-testid='dispense-queue'>
						<caption className='sr-only'>Prescriptions to dispense</caption>
						<thead>
							<tr>
								<th scope='col'>Patient</th>
								<th scope='col'>Prescription</th>
								<th scope='col'>Medicines</th>
								<th scope='col'>Issued</th>
								<th scope='col'>Status</th>
							</tr>
						</thead>
						<tbody>
							{queue.data.map((entry) => (
								<tr key={entry.prescriptionId} data-testid='dispense-row'>
									<td data-label='Patient'>
										<div className={styles.main}>{entry.patient.name}</div>
										<div className={styles.muted}>{entry.patient.patientNo}</div>
									</td>
									<td data-label='Prescription'>
										<Link
											to='/pharmacy/dispense/$prescriptionId'
											params={{ prescriptionId: entry.prescriptionId }}
											aria-label={`Dispense ${entry.rxNo} for ${entry.patient.name}`}
										>
											{entry.rxNo}
										</Link>
										<div className={styles.muted}>{entry.prescriberName ?? '—'}</div>
										{entry.isDangerousDrug && (
											<div className={styles.flags}>
												<ClinicalFlag tone='critical'>Dangerous drug (S2)</ClinicalFlag>
											</div>
										)}
									</td>
									<td data-label='Medicines'>
										{entry.items.map((item) => (
											<div key={item.id}>
												{item.genericName} {item.strength ?? ''} × {qty(item.quantity)}
												{item.dispensedQty > 0 && (
													<span className={styles.muted}>
														{' '}
														({qty(item.dispensedQty)} given)
													</span>
												)}
											</div>
										))}
									</td>
									<td data-label='Issued' className={styles.nowrap}>
										{formatDateTime(entry.issuedAt)}
									</td>
									<td data-label='Status'>
										<ClinicalFlag tone={DISPENSE_STATUS[entry.status].tone}>
											{DISPENSE_STATUS[entry.status].label}
										</ClinicalFlag>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</PageSection>
	);
}
