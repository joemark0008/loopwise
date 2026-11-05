import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './clinic-setup.module.css';
import { calendarDate, LoadError } from './setup-form';
import type { ExpiringCredential } from '@/lib/clinic-setup-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

const WINDOWS = ['30', '60', '90'] as const;

/** Expired, then due within 30 days, then later: the word always comes with the colour. */
function DaysLeft({ credential }: { credential: ExpiringCredential }) {
	const { daysLeft } = credential;
	if (daysLeft < 0) {
		return <ClinicalFlag tone='critical'>Expired {-daysLeft} days ago</ClinicalFlag>;
	}
	if (daysLeft === 0) {
		return <ClinicalFlag tone='critical'>Expires today</ClinicalFlag>;
	}
	return (
		<ClinicalFlag tone={daysLeft <= 30 ? 'abnormal' : 'info'}>
			{daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`}
		</ClinicalFlag>
	);
}

/**
 * Settings → Clinic → Expiring licenses: the PRC licenses, S2 licenses and PhilHealth PANs of the practitioners who
 * hold clinic here, and the clinic's DOH License to Operate and PhilHealth accreditation, that expire soon or have
 * expired. Renew them before documents and claims are refused.
 */
export function ExpiriesPage() {
	const [withinDays, setWithinDays] = useState<(typeof WINDOWS)[number]>('60');
	const expiries = useQuery(clinicSetupApi.expiries.queryOptions({ withinDays: Number(withinDays) }));

	return (
		<SettingsCard
			title='Expiring licenses'
			description='Licenses and accreditations that expire soon, and those already expired.'
			action={
				<Select value={withinDays} onValueChange={(value) => setWithinDays(value as (typeof WINDOWS)[number])}>
					<SelectTrigger aria-label='Window'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{WINDOWS.map((days) => (
							<SelectItem key={days} value={days}>
								Next {days} days
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			}
		>
			{expiries.error ? (
				<LoadError message={expiries.error.message} onRetry={() => void expiries.refetch()} />
			) : !expiries.data ? (
				<Skeleton className={styles.form} />
			) : expiries.data.length === 0 ? (
				<EmptyState title='Nothing expires soon'>
					No license or accreditation expires in the next {withinDays} days.
				</EmptyState>
			) : (
				<div className={styles.tableScroll}>
					<table className={styles.table} aria-label='Expiring licenses'>
						<thead>
							<tr>
								<th scope='col'>License</th>
								<th scope='col'>Holder</th>
								<th scope='col'>Number</th>
								<th scope='col'>Valid until</th>
								<th scope='col'>Status</th>
							</tr>
						</thead>
						<tbody>
							{expiries.data.map((credential) => (
								<tr key={`${credential.kind}-${credential.subjectId}`}>
									<td>{credential.label}</td>
									<td>{credential.subjectName}</td>
									<td className={styles.code}>{credential.number ?? '—'}</td>
									<td>{calendarDate(credential.expiresOn)}</td>
									<td>
										<DaysLeft credential={credential} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</SettingsCard>
	);
}
