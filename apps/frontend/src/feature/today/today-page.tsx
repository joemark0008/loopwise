import { ENCOUNTER_TYPE_LABELS } from '@loopwise/shared/encounter';
import { skipToken, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClock, FlaskConical, Receipt, Sparkles, Stethoscope, UserPlus, Users } from 'lucide-react';
import { Fragment } from 'react';
import { TodayCharts } from './today-charts';
import styles from './today.module.css';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CountAnimation } from '@/components/ui/count-animation';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatInput } from '@/feature/chat/components/chat-input';
import { formatDate, formatDateTime } from '@/feature/encounters/encounter-format';
import { EncounterStatusBadge } from '@/feature/encounters/encounter-status-badge';
import { ageLabel, identifierSummary, patientName } from '@/feature/patients/patient-format';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { encounterApi } from '@/lib/encounter-api';
import { patientApi } from '@/lib/patient-api';
import { cn } from '@/lib/utils';

const RECENT_PATIENTS = 6;

/** The visits still going on today: waiting, with the doctor or at the cashier. */
const QUEUE_STATUSES = ['OPEN', 'IN_PROGRESS', 'FOR_BILLING'] as const;

/**
 * The doctor's home (DESIGN.md §1–2), laid out as the kit's dashboard: Wise one question away first, then today's
 * numbers and charts, then today's visits, the patients in your care and the results to review, each full width. Asking Wise here starts a new chat.
 */
export function TodayPage() {
	const clinics = useQuery(patientApi.patient.clinics.queryOptions());
	const current = useCurrentClinic();
	// The selected clinic when the user works there, else their first care clinic.
	const clinic = clinics.data?.find((candidate) => candidate.id === current.data?.id) ?? clinics.data?.[0];
	const facility = clinic?.name;
	const visits = useTodaysVisits(clinic?.id);
	const patients = usePatientsInCare();

	const count = (status?: (typeof QUEUE_STATUSES)[number]) =>
		visits.data ? visits.data.filter((visit) => !status || visit.status === status).length : undefined;

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
			<SummaryCards
				stats={[
					{
						label: 'In the queue',
						value: count(),
						hint: 'visits open today',
						icon: CalendarClock,
						iconClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
					},
					{
						label: 'With the doctor',
						value: count('IN_PROGRESS'),
						hint: 'consultations under way',
						icon: Stethoscope,
						iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
					},
					{
						label: 'For billing',
						value: count('FOR_BILLING'),
						hint: 'waiting at the cashier',
						icon: Receipt,
						iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
					},
					{
						label: 'Patients in your care',
						value: patients.data?.length,
						hint: 'with a care relationship',
						icon: Users,
						iconClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
					},
				]}
			/>
			<TodayCharts clinicId={clinic?.id} />
			<TodaysVisits clinicId={clinic?.id} visits={visits} />
			<RecentPatients patients={patients} />
			<PageSection title='Results to review' meta='Critical first'>
				<EmptyState icon={FlaskConical} title='No results waiting'>
					Lab and imaging results for your patients arrive here once the results inbox is connected. A
					critical value always comes first.
				</EmptyState>
			</PageSection>
		</div>
	);
}

interface Stat {
	label: string;
	value: number | undefined;
	hint: string;
	icon: LucideIcon;
	iconClass: string;
}

/** The kit's summary strip: one card, a stat per column (stacked on a phone), each number counting up. */
function SummaryCards({ stats }: { stats: Stat[] }) {
	return (
		<Card>
			<CardContent className='p-0'>
				<div className='flex flex-col lg:flex-row'>
					{stats.map((stat, index) => (
						<Fragment key={stat.label}>
							{index > 0 && (
								<>
									<Separator className='lg:hidden' />
									<Separator orientation='vertical' className='hidden lg:block' />
								</>
							)}
							<div className='flex flex-1 items-start justify-between gap-3 p-4 lg:p-5'>
								<div className='space-y-2'>
									<p className='text-sm font-semibold text-foreground'>{stat.label}</p>
									<div className='font-display text-2xl text-foreground lg:text-3xl'>
										{stat.value === undefined ? (
											<Skeleton className='h-8 w-12' />
										) : (
											<CountAnimation number={stat.value} />
										)}
									</div>
									<p className='text-xs text-muted-foreground'>{stat.hint}</p>
								</div>
								<div
									className={cn(
										'flex size-10 shrink-0 items-center justify-center rounded-full',
										stat.iconClass,
									)}
									aria-hidden
								>
									<stat.icon className='size-4.5' />
								</div>
							</div>
						</Fragment>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/** Today's queue at the clinic: visits started today that are not done, oldest first. */
function useTodaysVisits(clinicId: string | undefined) {
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const startedFrom = startOfDay.toISOString();
	return useQuery(
		encounterApi.encounter.atClinic.queryOptions(
			clinicId ? { clinicId, statuses: [...QUEUE_STATUSES], startedFrom } : skipToken,
		),
	);
}

function TodaysVisits({
	clinicId,
	visits,
}: {
	clinicId: string | undefined;
	visits: ReturnType<typeof useTodaysVisits>;
}) {
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

function usePatientsInCare() {
	return useQuery(patientApi.patient.search.queryOptions({}));
}

function RecentPatients({ patients }: { patients: ReturnType<typeof usePatientsInCare> }) {
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
