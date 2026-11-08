import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
	CalendarClock,
	CalendarDays,
	CalendarPlus,
	CheckCheck,
	ChevronLeft,
	Ellipsis,
	ChevronRight,
	ListOrdered,
	LogIn,
	UserX,
	X,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { BookAppointmentDialog } from './book-appointment-dialog';
import { CheckInDialog } from './check-in-dialog';
import { appointmentSummary, nowIndex } from './queue-summary';
import {
	addDays,
	APPOINTMENT_STATUS,
	CHANNEL_LABELS,
	dayLabel,
	isUpcoming,
	manilaDate,
	manilaTime,
	VISIT_TYPE_LABELS,
} from './scheduling-format';
import { AppointmentStatusBadge, DoctorSelect, StatStrip, useSchedulingClinic } from './scheduling-parts';
import type { AppointmentFieldsFragment, AppointmentStatus } from '@/graphql/generated/graphql';
import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageHeader, PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
	const summary = appointments.data ? appointmentSummary(appointments.data) : undefined;

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
			<div className='flex flex-wrap items-center gap-2'>
				<div className='flex items-center rounded-lg border bg-background shadow-xs'>
					<Button
						size='icon'
						variant='ghost'
						className='rounded-r-none'
						aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
						onClick={() => go({ date: addDays(date, -step) })}
					>
						<ChevronLeft />
					</Button>
					<Input
						type='date'
						className='w-40 rounded-none border-y-0 shadow-none tabular-nums'
						value={date}
						aria-label='Day'
						onChange={(event) => event.target.value && go({ date: event.target.value })}
					/>
					<Button
						size='icon'
						variant='ghost'
						className='rounded-l-none'
						aria-label={view === 'week' ? 'Next week' : 'Next day'}
						onClick={() => go({ date: addDays(date, step) })}
					>
						<ChevronRight />
					</Button>
				</div>
				{date !== today && (
					<Button variant='outline' onClick={() => go({ date: today })}>
						Today
					</Button>
				)}
				<div role='group' aria-label='View' className='inline-flex rounded-lg bg-muted p-0.5'>
					{(['day', 'week'] as const).map((option) => (
						<Button
							key={option}
							size='sm'
							variant='ghost'
							aria-pressed={view === option}
							className={cn(
								'px-3.5 text-muted-foreground',
								view === option && 'bg-background text-foreground shadow-xs hover:bg-background',
							)}
							onClick={() => go({ view: option })}
						>
							{option === 'day' ? 'Day' : 'Week'}
						</Button>
					))}
				</div>
				<DoctorSelect
					clinicId={clinicId}
					value={doctor}
					onChange={(value) => go({ doctor: value === 'all' ? undefined : value })}
					allLabel='All doctors'
					className='sm:ml-auto'
				/>
			</div>
			<StatStrip
				label={view === 'week' ? 'The week in bookings' : 'The day in bookings'}
				stats={[
					{ label: 'To come', value: summary?.toCome, hint: 'Booked or confirmed' },
					{ label: 'Checked in', value: summary?.here, hint: 'Here or with the doctor' },
					{ label: 'Seen', value: summary?.seen, hint: 'Visits finished' },
					{ label: 'No-shows', value: summary?.noShow, hint: 'Did not come' },
				]}
			/>
			{appointments.isPending ? (
				<Skeleton className='h-80 rounded-xl' />
			) : appointments.error ? (
				<ErrorMessage message={appointments.error.message} />
			) : view === 'week' ? (
				<WeekView
					from={date}
					today={today}
					appointments={appointments.data}
					onOpenDay={(day) => go({ date: day, view: 'day' })}
				/>
			) : (
				<PageSection
					title={dayLabel(date)}
					meta={`${appointments.data.length} ${appointments.data.length === 1 ? 'booking' : 'bookings'}`}
				>
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
	const now = new Date();
	const split = isToday
		? nowIndex(
				appointments.map((appointment) => appointment.scheduledStart),
				now,
			)
		: -1;
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
					{appointments.map((appointment, index) => (
						<Fragment key={appointment.id}>
							{index === split && <NowRow now={now} />}
							<AppointmentRow clinicId={clinicId} isToday={isToday} appointment={appointment} />
						</Fragment>
					))}
					{split === appointments.length && <NowRow now={now} />}
				</tbody>
			</table>
		</div>
	);
}

/** Today's clock between the bookings already past and the ones to come. */
function NowRow({ now }: { now: Date }) {
	return (
		<tr aria-hidden className='border-0'>
			<td colSpan={6} className='py-0!'>
				<div className='flex items-center gap-2'>
					<span className='rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground tabular-nums'>
						Now {manilaTime(now)}
					</span>
					<span className='h-px flex-1 bg-primary' />
				</div>
			</td>
		</tr>
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
			<td data-label='Time' className='whitespace-nowrap'>
				<span className='font-display text-base font-semibold text-foreground tabular-nums'>
					{manilaTime(appointment.scheduledStart)}
				</span>
			</td>
			<td data-label='Patient'>
				<div className='flex min-w-0 items-center gap-3'>
					<Avatar username={name} decorative className='hidden shrink-0 sm:inline-flex' />
					<div className='flex min-w-0 flex-col gap-0.5'>
						<Link
							to='/patients/$patientId'
							params={{ patientId: appointment.patientId }}
							className='font-semibold text-foreground hover:text-primary hover:underline'
						>
							{name}
						</Link>
						<span className='text-xs text-muted-foreground tabular-nums'>
							{appointment.patient.patientNo}
						</span>
						{appointment.reason && (
							<span className='line-clamp-1 text-xs text-muted-foreground'>{appointment.reason}</span>
						)}
					</div>
				</div>
			</td>
			<td data-label='Doctor' className='text-sm'>
				{appointment.practitioner.name}
			</td>
			<td data-label='Visit'>
				<div className='flex flex-col gap-0.5'>
					<span className='text-sm whitespace-nowrap'>{VISIT_TYPE_LABELS[appointment.visitType]}</span>
					<span className='text-xs text-muted-foreground'>{CHANNEL_LABELS[appointment.channel]}</span>
				</div>
			</td>
			<td data-label='Status'>
				<div className='flex flex-col items-start gap-1'>
					<AppointmentStatusBadge status={appointment.status} />
					{appointment.encounter && (
						<span className='text-xs text-muted-foreground tabular-nums'>
							{appointment.encounter.encounterNo}
						</span>
					)}
				</div>
			</td>
			<td data-label='Actions'>
				<div className='flex items-center justify-end gap-1.5'>
					{upcoming && isToday && (
						<Button size='sm' onClick={() => setDialog('check-in')} aria-label={`Check in ${name}`}>
							<LogIn />
							Check in
						</Button>
					)}
					{upcoming && (
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button size='icon-md' variant='ghost' aria-label={`More actions for ${name}`}>
									<Ellipsis />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end' className='min-w-48'>
								{appointment.status === 'SCHEDULED' && (
									<DropdownMenuItem
										disabled={confirm.isPending}
										onSelect={() => confirm.mutate({ appointmentId: appointment.id })}
									>
										<CheckCheck />
										Mark confirmed
									</DropdownMenuItem>
								)}
								<DropdownMenuItem onSelect={() => setDialog('reschedule')}>
									<CalendarClock />
									Reschedule
								</DropdownMenuItem>
								{past && (
									<DropdownMenuItem
										disabled={noShow.isPending}
										onSelect={() => noShow.mutate({ appointmentId: appointment.id })}
									>
										<UserX />
										Mark as no-show
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem variant='destructive' onSelect={() => setDialog('cancel')}>
									<X />
									Cancel booking
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
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

/** A booking's chip tint by its status tone; the legend under the week names them. */
const TONE_TINT: Record<ClinicalTone, string> = {
	info: 'bg-info-bg',
	normal: 'bg-muted',
	done: 'bg-done-bg',
	abnormal: 'bg-abnormal-bg',
	critical: 'bg-critical-bg',
	void: 'bg-muted/50',
	draft: 'bg-muted/50',
	wise: 'bg-wise-bg',
};

const WEEK_LEGEND: { tone: ClinicalTone; label: string }[] = [
	{ tone: 'info', label: 'Booked' },
	{ tone: 'normal', label: 'Checked in' },
	{ tone: 'done', label: 'Seen' },
	{ tone: 'abnormal', label: 'No-show' },
	{ tone: 'void', label: 'Cancelled or moved, struck through' },
];

function WeekView({
	from,
	today,
	appointments,
	onOpenDay,
}: {
	from: string;
	today: string;
	appointments: AppointmentFieldsFragment[];
	onOpenDay: (day: string) => void;
}) {
	const days = Array.from({ length: 7 }, (_, index) => addDays(from, index));
	return (
		<div className='flex flex-col gap-3'>
			<div
				className='grid gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-7'
				data-testid='appointment-week'
			>
				{days.map((day) => {
					const items = appointments.filter(
						(appointment) => manilaDate(new Date(appointment.scheduledStart)) === day,
					);
					const isToday = day === today;
					const [weekday, dayOfMonth] = dayLabel(day).split(' ');
					return (
						<section
							key={day}
							className='flex min-w-0 flex-col bg-card lg:min-h-80'
							aria-label={dayLabel(day)}
						>
							<h2 className='m-0'>
								<button
									type='button'
									className='flex w-full items-center gap-2 border-b px-3 py-2.5 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-muted'
									onClick={() => onOpenDay(day)}
								>
									<span className='text-xs text-muted-foreground'>{weekday}</span>
									<span
										className={cn(
											'inline-flex size-7 items-center justify-center rounded-full font-display text-sm font-semibold tabular-nums',
											isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
										)}
									>
										{dayOfMonth}
									</span>
									<span className='ml-auto text-xs text-muted-foreground tabular-nums'>
										{items.length}
									</span>
								</button>
							</h2>
							<div className='flex flex-col gap-1.5 p-2'>
								{items.length === 0 && (
									<p className='px-1 py-2 text-xs text-muted-foreground'>No bookings</p>
								)}
								{items.map((appointment) => {
									const closed = CLOSED.includes(appointment.status);
									return (
										<div
											key={appointment.id}
											className={cn(
												'flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs',
												TONE_TINT[APPOINTMENT_STATUS[appointment.status].tone],
											)}
										>
											<span
												className={cn(
													'flex items-baseline gap-1.5 text-foreground',
													closed && 'text-muted-foreground line-through',
												)}
											>
												<span className='font-semibold tabular-nums'>
													{manilaTime(appointment.scheduledStart)}
												</span>
												<span className='truncate'>{appointment.patient.name}</span>
											</span>
											<span className='truncate text-muted-foreground'>
												{appointment.practitioner.shortName}
												{closed &&
													`, ${APPOINTMENT_STATUS[appointment.status].label.toLowerCase()}`}
											</span>
										</div>
									);
								})}
							</div>
						</section>
					);
				})}
			</div>
			<ul className='flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground' aria-label='Colours'>
				{WEEK_LEGEND.map((entry) => (
					<li key={entry.tone} className='flex items-center gap-1.5'>
						<span
							className={cn('size-3 rounded-sm ring-1 ring-border', TONE_TINT[entry.tone])}
							aria-hidden
						/>
						{entry.label}
					</li>
				))}
			</ul>
		</div>
	);
}
