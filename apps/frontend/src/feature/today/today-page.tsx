import { ENCOUNTER_TYPE_LABELS } from '@loopwise/shared/encounter';
import { skipToken, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClock, FlaskConical, Sparkles, UserPlus } from 'lucide-react';
import styles from './today.module.css';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { formatDate, formatDateTime } from '@/feature/encounters/encounter-format';
import { EncounterStatusBadge } from '@/feature/encounters/encounter-status-badge';
import { ageLabel, identifierSummary, patientName } from '@/feature/patients/patient-format';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { encounterApi } from '@/lib/encounter-api';
import { patientApi } from '@/lib/patient-api';

const RECENT_PATIENTS = 6;

/** The visits still going on today: waiting, with the doctor or at the cashier. */
const QUEUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'FOR_BILLING'] as const;

/**
 * The doctor's home (DESIGN.md §1–2): results to review first, today's visits at the clinic and the patients in your
 * care, with Wise one question away. Asking Wise here starts a new chat.
 */
export function TodayPage() {
	const clinics = useQuery(patientApi.patient.clinics.queryOptions());
	const current = useCurrentClinic();
	// The selected clinic when the user works there, else their first care clinic.
	const clinic = clinics.data?.find((candidate) => candidate.id === current.data?.id) ?? clinics.data?.[0];
	const facility = clinic?.name;

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
				<ChatInput className={styles.askInput} />
			</section>
			<div className={styles.grid}>
				<div className={styles.column}>
					<PageSection title='Results to review' meta='Critical first'>
						<EmptyState icon={FlaskConical} title='No results waiting'>
							Lab and imaging results for your patients arrive here once the results inbox is connected. A
							critical value always comes first.
						</EmptyState>
					</PageSection>
					<TodaysVisits clinicId={clinic?.id} />
				</div>
				<div className={styles.column}>
					<RecentPatients />
				</div>
			</div>
		</div>
	);
}

/** Today's queue at the clinic: visits started today that are not done, oldest first. */
function TodaysVisits({ clinicId }: { clinicId: string | undefined }) {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const startedFrom = startOfDay.toISOString();
	const visits = useQuery(
		encounterApi.encounter.atClinic.queryOptions(
			clinicId ? { clinicId, statuses: [...QUEUE_STATUSES], startedFrom } : skipToken,
		),
	);
	return (
		<PageSection title="Today's visits" meta='Oldest first'>
			{!clinicId ? (
				<EmptyState icon={CalendarClock} title='No clinic'>
					You don't work at a clinic yet, so there is no queue to show.
				</EmptyState>
			) : visits.isPending ? (
				<Skeleton className={styles.skeleton} />
			) : visits.error ? (
				<ErrorMessage message={visits.error.message} />
			) : visits.data.length === 0 ? (
				<EmptyState icon={CalendarClock} title='No one waiting'>
					Visits opened today show here until they are completed.
				</EmptyState>
			) : (
				<table className={pageStyles.table} data-reflow data-testid='todays-visits'>
					<thead>
						<tr>
							<th scope='col'>Visit</th>
							<th scope='col'>Chief complaint</th>
							<th scope='col'>Status</th>
						</tr>
					</thead>
					<tbody>
						{visits.data.map((visit) => (
							<tr key={visit.id}>
								<td data-label='Visit'>
									<Link
										to='/patients/$patientId/encounters/$encounterId'
										params={{ patientId: visit.patientId, encounterId: visit.id }}
										className={styles.patientLink}
									>
										{visit.encounterNo}
									</Link>
									<span className={styles.muted}>
										{' '}
										· {ENCOUNTER_TYPE_LABELS[visit.type]} · {formatDateTime(visit.startedAt)}
									</span>
								</td>
								<td data-label='Chief complaint'>{visit.reason ?? '—'}</td>
								<td data-label='Status' className={styles.nowrap}>
									<EncounterStatusBadge status={visit.status} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</PageSection>
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
