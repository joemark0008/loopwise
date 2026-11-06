import { DISPOSITION_LABELS } from '@loopwise/shared/encounter-record';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CalendarCheck, CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import styles from './follow-ups.module.css';
import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import type { FollowUpFieldsFragment, FollowUpTiming } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDay } from '@/feature/encounters/encounter-format';
import { BookAppointmentDialog } from '@/feature/scheduling/book-appointment-dialog';
import { manilaDate } from '@/feature/scheduling/scheduling-format';
import { DoctorSelect, useSchedulingClinic } from '@/feature/scheduling/scheduling-parts';
import { useDesks, useStaffRole } from '@/hooks/use-staff-role';
import { followUpApi } from '@/lib/follow-up-api';
import { patientApi } from '@/lib/patient-api';

export interface FollowUpsSearch {
	doctor?: string;
	within?: number;
}

/** The windows ahead the list offers, in days. */
export const FOLLOW_UP_WINDOWS = [7, 14, 30] as const;

const TIMING: Record<FollowUpTiming, { label: (days: number) => string; tone: ClinicalTone }> = {
	OVERDUE: { label: (days) => `Overdue ${-days} d`, tone: 'abnormal' },
	DUE: { label: () => 'Due today', tone: 'info' },
	UPCOMING: { label: (days) => `In ${days} d`, tone: 'draft' },
};

/**
 * Follow-ups (DESIGN.md §6): the patients whose follow-up date is overdue, due today or coming up, with the
 * disposition, until a later visit or booking with the same doctor. A doctor sees their own; the front desk and
 * admins the clinic's, by doctor, and book from a row: the booking dialog opens with the patient, the doctor, the
 * suggested day and a follow-up visit filled in. Nothing messages the patient.
 */
export function FollowUpsPage({ search }: { search: FollowUpsSearch }) {
	const navigate = useNavigate();
	const { clinicId } = useSchedulingClinic();
	const desks = useDesks();
	const ownDesk = useStaffRole();
	const isDoctorOnly = ownDesk === 'doctor' && !desks.includes('front_desk');
	const canBook = desks.includes('front_desk');
	const doctor = search.doctor ?? 'all';
	const within = search.within ?? 7;
	const [booking, setBooking] = useState<FollowUpFieldsFragment | null>(null);
	const go = (next: FollowUpsSearch) => void navigate({ to: '/follow-ups', search: { ...search, ...next } });

	const followUps = useQuery(
		followUpApi.list.queryOptions(
			{
				clinicId: clinicId ?? '',
				practitionerId: isDoctorOnly || doctor === 'all' ? null : doctor,
				withinDays: within,
			},
			{ enabled: Boolean(clinicId) },
		),
	);
	const rows = followUps.data ?? [];
	const overdue = rows.filter((row) => row.timing === 'OVERDUE').length;

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Follow-ups'
				subtitle={
					isDoctorOnly
						? 'Your patients due back, overdue first. Booked or seen again, they leave the list.'
						: "The clinic's patients due back, overdue first. Book them from here."
				}
			/>
			<div className={styles.toolbar}>
				{!isDoctorOnly && (
					<DoctorSelect
						clinicId={clinicId}
						value={doctor}
						onChange={(value) => go({ doctor: value === 'all' ? undefined : value })}
						allLabel='All doctors'
					/>
				)}
				<Select value={String(within)} onValueChange={(value) => go({ within: Number(value) })}>
					<SelectTrigger aria-label='Coming up within' className={styles.windowSelect}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FOLLOW_UP_WINDOWS.map((days) => (
							<SelectItem key={days} value={String(days)}>
								Due within {days} days
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{followUps.isPending ? (
				<Skeleton />
			) : followUps.error ? (
				<ErrorMessage message={followUps.error.message} />
			) : (
				<PageSection
					title='Due back'
					meta={overdue > 0 ? `${rows.length} · ${overdue} overdue` : String(rows.length)}
				>
					{rows.length === 0 ? (
						<EmptyState icon={CalendarCheck} title='No follow-ups due'>
							Visits with a follow-up date show here until the patient is booked or seen again.
						</EmptyState>
					) : (
						<div className={pageStyles.tableScroll}>
							<table className={pageStyles.table} data-reflow data-testid='follow-up-list'>
								<caption className='sr-only'>Follow-ups</caption>
								<thead>
									<tr>
										<th scope='col'>Due</th>
										<th scope='col'>Patient</th>
										<th scope='col'>Doctor</th>
										<th scope='col'>Last visit</th>
										<th scope='col'>Disposition</th>
										<th scope='col'>
											<span className='sr-only'>Actions</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<FollowUpRow
											key={row.encounterId}
											row={row}
											canBook={canBook}
											onBook={() => setBooking(row)}
										/>
									))}
								</tbody>
							</table>
						</div>
					)}
				</PageSection>
			)}
			{booking && (
				<BookFollowUpDialog
					key={booking.encounterId}
					clinicId={clinicId}
					followUp={booking}
					onClose={() => setBooking(null)}
				/>
			)}
		</div>
	);
}

function FollowUpRow({ row, canBook, onBook }: { row: FollowUpFieldsFragment; canBook: boolean; onBook: () => void }) {
	const timing = TIMING[row.timing];
	return (
		<tr data-testid='follow-up-row' data-encounter-id={row.encounterId}>
			<td data-label='Due' className={styles.nowrap}>
				<div className={styles.stack}>
					<span className={styles.main}>{formatDay(row.followUpDate)}</span>
					<ClinicalFlag tone={timing.tone}>{timing.label(row.daysFromToday)}</ClinicalFlag>
				</div>
			</td>
			<td data-label='Patient'>
				<div className={styles.stack}>
					<Link to='/patients/$patientId' params={{ patientId: row.patientId }} className={styles.main}>
						{row.patientName}
					</Link>
					<span className={styles.muted}>
						{row.patientNo}
						{row.mobileNo && ` · ${row.mobileNo}`}
					</span>
				</div>
			</td>
			<td data-label='Doctor'>{row.doctorName ?? 'No doctor'}</td>
			<td data-label='Last visit'>
				<div className={styles.stack}>
					<Link
						to='/patients/$patientId/encounters/$encounterId'
						params={{ patientId: row.patientId, encounterId: row.encounterId }}
					>
						{formatDate(row.visitedAt)}
					</Link>
					<span className={styles.muted}>{row.diagnosis ?? row.reason ?? row.encounterNo}</span>
				</div>
			</td>
			<td data-label='Disposition'>{row.disposition ? DISPOSITION_LABELS[row.disposition] : 'Not recorded'}</td>
			<td data-label='Actions' className={styles.actions}>
				{canBook && row.practitionerId && (
					<Button size='sm' onClick={onBook} aria-label={`Book follow-up for ${row.patientName}`}>
						<CalendarPlus />
						Book follow-up
					</Button>
				)}
			</td>
		</tr>
	);
}

/**
 * Scheduling's booking dialog for one follow-up: the patient (read as the desk), the visit's doctor, the follow-up
 * date (today when it has passed), a FOLLOW_UP visit and its reason.
 */
function BookFollowUpDialog({
	clinicId,
	followUp,
	onClose,
}: {
	clinicId: string | null;
	followUp: FollowUpFieldsFragment;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const patient = useQuery(patientApi.patient.get.queryOptions({ id: followUp.patientId }));
	const today = manilaDate();
	if (patient.error) {
		return <ErrorMessage message={patient.error.message} />;
	}
	if (!patient.data) {
		return null;
	}
	return (
		<BookAppointmentDialog
			clinicId={clinicId}
			open
			onOpenChange={(open) => {
				if (!open) {
					// Booked or not, read the list again: a booking with the doctor takes the row off.
					void queryClient.invalidateQueries(followUpApi.invalidate);
					onClose();
				}
			}}
			initialDate={followUp.followUpDate < today ? today : followUp.followUpDate}
			initialDoctorId={followUp.practitionerId ?? undefined}
			initialPatient={patient.data}
			initialVisitType='FOLLOW_UP'
			initialReason={`Follow-up of ${followUp.diagnosis ?? followUp.reason ?? followUp.encounterNo}`}
		/>
	);
}
