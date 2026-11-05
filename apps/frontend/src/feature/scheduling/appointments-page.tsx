import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { useState } from 'react';
import { BookAppointmentDialog } from './book-appointment-dialog';
import { CheckInDialog } from './check-in-dialog';
import styles from './scheduling.module.css';
import {
	addDays,
	CHANNEL_LABELS,
	dayLabel,
	isUpcoming,
	manilaDate,
	manilaTime,
	VISIT_TYPE_LABELS,
} from './scheduling-format';
import { AppointmentStatusBadge, DoctorSelect, useSchedulingClinic } from './scheduling-parts';
import type { AppointmentFieldsFragment, AppointmentStatus } from '@/graphql/generated/graphql';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

export type AppointmentsView = 'day' | 'week';

const CLOSED: readonly AppointmentStatus[] = ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'];

export interface AppointmentsSearch {
	date?: string;
	view?: AppointmentsView;
	doctor?: string;
}

/**
 * The front desk's calendar: a day (or a week) of bookings, for the clinic or one doctor. Book, confirm, reschedule,
 * cancel with a reason, mark a no-show, and check today's patients in (which opens the visit and gives the queue
 * number).
 */
export function AppointmentsPage({ search }: { search: AppointmentsSearch }) {
	const navigate = useNavigate();
	const { clinicId } = useSchedulingClinic();
	const today = manilaDate();
	const date = search.date ?? today;
	const view = search.view ?? 'day';
	const doctor = search.doctor ?? 'all';
	const [booking, setBooking] = useState(false);
	const go = (next: AppointmentsSearch) => void navigate({ to: '/appointments', search: { ...search, ...next } });

	const appointments = useQuery(
		schedulingApi.appointments.queryOptions(
			{
				clinicId: clinicId ?? '',
				from: date,
				days: view === 'week' ? 7 : 1,
				practitionerId: doctor === 'all' ? null : doctor,
			},
			{ enabled: Boolean(clinicId), refetchInterval: 30_000 },
		),
	);
	const step = view === 'week' ? 7 : 1;

	return (
		<div className={pageStyles.page}>
			<PageHeader
				title='Appointments'
				subtitle="The clinic's bookings, by day or week."
				actions={
					<>
						<Button variant='outline' asChild>
							<Link to='/queue'>
								<ListOrdered />
								Queue
							</Link>
						</Button>
						<Button onClick={() => setBooking(true)}>
							<CalendarPlus />
							Book
						</Button>
					</>
				}
			/>
			<div className={styles.toolbar}>
				<div className={styles.toolbarGroup}>
					<Button
						size='icon-sm'
						variant='outline'
						aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
						onClick={() => go({ date: addDays(date, -step) })}
					>
						<ChevronLeft />
					</Button>
					<Input
						type='date'
						className={styles.dateInput}
						value={date}
						aria-label='Day'
						onChange={(event) => event.target.value && go({ date: event.target.value })}
					/>
					<Button
						size='icon-sm'
						variant='outline'
						aria-label={view === 'week' ? 'Next week' : 'Next day'}
						onClick={() => go({ date: addDays(date, step) })}
					>
						<ChevronRight />
					</Button>
					{date !== today && (
						<Button size='sm' variant='ghost-muted' onClick={() => go({ date: today })}>
							Today
						</Button>
					)}
				</div>
				<div className={styles.toolbarGroup} role='group' aria-label='View'>
					<Button
						size='sm'
						variant={view === 'day' ? 'default' : 'outline'}
						aria-pressed={view === 'day'}
						onClick={() => go({ view: 'day' })}
					>
						Day
					</Button>
					<Button
						size='sm'
						variant={view === 'week' ? 'default' : 'outline'}
						aria-pressed={view === 'week'}
						onClick={() => go({ view: 'week' })}
					>
						Week
					</Button>
				</div>
				<DoctorSelect
					clinicId={clinicId}
					value={doctor}
					onChange={(value) => go({ doctor: value === 'all' ? undefined : value })}
					allLabel='All doctors'
				/>
			</div>
			{appointments.isPending ? (
				<Skeleton />
			) : appointments.error ? (
				<ErrorMessage message={appointments.error.message} />
			) : view === 'week' ? (
				<WeekView from={date} today={today} appointments={appointments.data} />
			) : (
				<PageSection title={dayLabel(date)} meta={String(appointments.data.length)}>
					{appointments.data.length === 0 ? (
						<EmptyState icon={CalendarDays} title='No bookings'>
							Book a patient with Book, or ask Wise in the patient's chart.
						</EmptyState>
					) : (
						<DayTable clinicId={clinicId} isToday={date === today} appointments={appointments.data} />
					)}
				</PageSection>
			)}
			<BookAppointmentDialog
				key={`${date}-${doctor}`}
				clinicId={clinicId}
				open={booking}
				onOpenChange={setBooking}
				initialDate={date < today ? today : date}
				initialDoctorId={doctor === 'all' ? undefined : doctor}
			/>
		</div>
	);
}

function DayTable({
	clinicId,
	isToday,
	appointments,
}: {
	clinicId: string | null;
	isToday: boolean;
	appointments: AppointmentFieldsFragment[];
}) {
	return (
		<div className={pageStyles.tableScroll}>
			<table className={pageStyles.table} data-reflow data-testid='appointment-list'>
				<caption className='sr-only'>Appointments</caption>
				<thead>
					<tr>
						<th scope='col'>Time</th>
						<th scope='col'>Patient</th>
						<th scope='col'>Doctor</th>
						<th scope='col'>Visit</th>
						<th scope='col'>Status</th>
						<th scope='col'>
							<span className='sr-only'>Actions</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{appointments.map((appointment) => (
						<AppointmentRow
							key={appointment.id}
							clinicId={clinicId}
							isToday={isToday}
							appointment={appointment}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

function AppointmentRow({
	clinicId,
	isToday,
	appointment,
}: {
	clinicId: string | null;
	isToday: boolean;
	appointment: AppointmentFieldsFragment;
}) {
	const queryClient = useQueryClient();
	const [dialog, setDialog] = useState<'check-in' | 'reschedule' | 'cancel' | null>(null);
	const refresh = { onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate) };
	const confirm = useMutation(schedulingApi.confirm.mutationOptions(refresh));
	const noShow = useMutation(schedulingApi.noShow.mutationOptions(refresh));
	const cancel = useMutation(schedulingApi.cancel.mutationOptions({ ...refresh, onSuccess: () => setDialog(null) }));
	const name = appointment.patient.name;
	const upcoming = isUpcoming(appointment.status);
	const past = new Date(appointment.scheduledStart) < new Date();
	const error = confirm.error ?? noShow.error;

	return (
		<tr data-testid='appointment-row' data-appointment-id={appointment.id}>
			<td data-label='Time' className={styles.nowrap}>
				<span className={styles.main}>{manilaTime(appointment.scheduledStart)}</span>
			</td>
			<td data-label='Patient'>
				<div className={styles.stack}>
					<Link
						to='/patients/$patientId'
						params={{ patientId: appointment.patientId }}
						className={styles.main}
					>
						{name}
					</Link>
					<span className={styles.muted}>
						{appointment.patient.patientNo}
						{appointment.reason && ` · ${appointment.reason}`}
					</span>
				</div>
			</td>
			<td data-label='Doctor'>{appointment.practitioner.name}</td>
			<td data-label='Visit'>
				<div className={styles.stack}>
					<span>{VISIT_TYPE_LABELS[appointment.visitType]}</span>
					<span className={styles.muted}>{CHANNEL_LABELS[appointment.channel]}</span>
				</div>
			</td>
			<td data-label='Status'>
				<AppointmentStatusBadge status={appointment.status} />
				{appointment.encounter && <div className={styles.muted}>{appointment.encounter.encounterNo}</div>}
			</td>
			<td data-label='Actions'>
				<div className={styles.actions}>
					{upcoming && isToday && (
						<Button size='sm' onClick={() => setDialog('check-in')} aria-label={`Check in ${name}`}>
							Check in
						</Button>
					)}
					{appointment.status === 'SCHEDULED' && (
						<Button
							size='sm'
							variant='outline'
							disabled={confirm.isPending}
							onClick={() => confirm.mutate({ appointmentId: appointment.id })}
							aria-label={`Mark ${name}'s booking confirmed`}
						>
							Confirmed
						</Button>
					)}
					{upcoming && (
						<Button
							size='sm'
							variant='outline'
							onClick={() => setDialog('reschedule')}
							aria-label={`Reschedule ${name}`}
						>
							Reschedule
						</Button>
					)}
					{upcoming && past && (
						<Button
							size='sm'
							variant='outline'
							disabled={noShow.isPending}
							onClick={() => noShow.mutate({ appointmentId: appointment.id })}
							aria-label={`Mark ${name} as a no-show`}
						>
							No-show
						</Button>
					)}
					{upcoming && (
						<Button
							size='sm'
							variant='ghost-muted'
							onClick={() => setDialog('cancel')}
							aria-label={`Cancel ${name}'s booking`}
						>
							Cancel
						</Button>
					)}
				</div>
				{error && <ErrorMessage message={error.message} />}
				<CheckInDialog
					clinicId={clinicId}
					appointment={appointment}
					open={dialog === 'check-in'}
					onOpenChange={(open) => setDialog(open ? 'check-in' : null)}
				/>
				{dialog === 'reschedule' && (
					<BookAppointmentDialog
						clinicId={clinicId}
						open
						onOpenChange={(open) => setDialog(open ? 'reschedule' : null)}
						initialDate={manilaDate(new Date(appointment.scheduledStart))}
						rescheduling={appointment}
					/>
				)}
				<VoidDialog
					open={dialog === 'cancel'}
					onOpenChange={(open) => setDialog(open ? 'cancel' : null)}
					title={`Cancel ${name}'s booking?`}
					description='The slot opens for someone else. The reason stays with the booking.'
					actionLabel='Cancel booking'
					placeholder='Patient feeling better'
					onVoid={(reason) => cancel.mutate({ appointmentId: appointment.id, reason })}
					isPending={cancel.isPending}
					error={cancel.error?.message}
				/>
			</td>
		</tr>
	);
}

function WeekView({
	from,
	today,
	appointments,
}: {
	from: string;
	today: string;
	appointments: AppointmentFieldsFragment[];
}) {
	const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
	return (
		<div className={styles.week} data-testid='appointment-week'>
			{days.map((day) => {
				const items = appointments.filter(
					(appointment) => manilaDate(new Date(appointment.scheduledStart)) === day,
				);
				return (
					<section
						key={day}
						className={cn(styles.weekDay, day === today && styles.weekDayToday)}
						aria-label={dayLabel(day)}
					>
						<h2 className={styles.weekDayTitle}>
							{dayLabel(day)} <span className={styles.muted}>· {items.length}</span>
						</h2>
						{items.map((appointment) => (
							<div
								key={appointment.id}
								className={cn(
									styles.weekItem,
									CLOSED.includes(appointment.status) && styles.weekItemVoid,
								)}
							>
								<span className={styles.main}>
									{manilaTime(appointment.scheduledStart)} {appointment.patient.name}
								</span>
								<span className={styles.muted}>{appointment.practitioner.shortName}</span>
							</div>
						))}
					</section>
				);
			})}
		</div>
	);
}
