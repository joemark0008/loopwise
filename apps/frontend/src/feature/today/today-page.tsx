import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FlaskConical, Sparkles, UserPlus, Waypoints } from 'lucide-react';
import styles from './today.module.css';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { formatDate } from '@/feature/encounters/encounter-format';
import { ageLabel, identifierSummary, patientName } from '@/feature/patients/patient-format';
import { patientApi } from '@/lib/patient-api';

const RECENT_PATIENTS = 6;

/**
 * The doctor's home (DESIGN.md §3–4): results to review first, then the patients in your care and the loops that are
 * overdue, with Wise one question away. Asking Wise here starts a new chat.
 */
export function TodayPage() {
	const facilities = useQuery(patientApi.patient.facilities.queryOptions());
	const facility = facilities.data?.[0]?.name;

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Today'
				subtitle={[formatDate(new Date().toISOString()), facility].filter(Boolean).join(' · ')}
				actions={
					<Button variant='outline' asChild>
						<Link to='/patients/new'>
							<UserPlus />
							Register patient
						</Link>
					</Button>
				}
			/>
			<section className={styles.ask} aria-labelledby='today-ask'>
				<p id='today-ask' className={styles.askLabel}>
					<Sparkles aria-hidden />
					Ask Wise
				</p>
				<ChatInput />
			</section>
			<div className={styles.grid}>
				<div className={styles.column}>
					<PageSection title='Results to review' meta='Critical first'>
						<EmptyState icon={FlaskConical} title='No results waiting'>
							Lab and imaging results for your patients arrive here once the results inbox is connected. A
							critical value always comes first.
						</EmptyState>
					</PageSection>
					<PageSection title='My overdue loops'>
						<EmptyState icon={Waypoints} title='Nothing overdue'>
							Cases past their deadline (a referral not accepted, a patient not reached) show here when
							the case engine runs.
						</EmptyState>
					</PageSection>
				</div>
				<div className={styles.column}>
					<RecentPatients />
				</div>
			</div>
		</div>
	);
}

function RecentPatients() {
	const patients = useQuery(patientApi.patient.search.queryOptions({}));
	const rows = patients.data?.slice(0, RECENT_PATIENTS) ?? [];
	return (
		<PageSection
			title='Patients in your care'
			meta={
				<Link to='/patients' className={styles.patientLink}>
					All patients
				</Link>
			}
		>
			{patients.isPending ? (
				<Skeleton className={styles.skeleton} />
			) : patients.error ? (
				<ErrorMessage message={patients.error.message} />
			) : rows.length === 0 ? (
				<EmptyState title='No patients yet'>Register a patient to start their chart.</EmptyState>
			) : (
				<table className={pageStyles.table} data-reflow>
					<thead>
						<tr>
							<th scope='col'>Patient</th>
							<th scope='col'>Age</th>
							<th scope='col'>Identifiers</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((patient) => (
							<tr key={patient.id}>
								<td data-label='Patient'>
									<Link
										to='/patients/$patientId'
										params={{ patientId: patient.id }}
										className={styles.patientLink}
									>
										{patientName(patient)}
									</Link>
								</td>
								<td data-label='Age' className={styles.nowrap}>
									{ageLabel(patient.birthDate, patient.sex)}
								</td>
								<td data-label='Identifiers' className={styles.muted}>
									{identifierSummary(patient)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</PageSection>
	);
}
