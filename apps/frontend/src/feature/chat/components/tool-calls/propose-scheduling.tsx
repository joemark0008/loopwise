import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClock, CalendarDays, CalendarPlus, ListOrdered } from 'lucide-react';
import { memo, useState } from 'react';
import { ActionCard, ActionFrame } from './propose-action';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { ToolPart } from './propose-action';
import type { listAppointments, listQueue } from '@loopwise/shared/tools';
import type { ActionOutput, ProposeAppointmentInput, ProposeRescheduleInput } from '@loopwise/shared/wise-actions';
import type { ToolCallComponentProps } from '.';
import type { AppointmentFieldsFragment } from '@/graphql/generated/graphql';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { FormField } from '@/feature/encounters/form-field';
import {
	CHANNEL_LABELS,
	dayLabel,
	manilaDate,
	manilaTime,
	PRIORITY_REASON_LABELS,
	QUEUE_STATUS,
	APPOINTMENT_STATUS,
	VISIT_TYPE_LABELS,
} from '@/feature/scheduling/scheduling-format';
import { DoctorSelect, SlotPicker, useClinicDoctors, useSchedulingClinic } from '@/feature/scheduling/scheduling-parts';
import { patientApi } from '@/lib/patient-api';
import { schedulingApi } from '@/lib/scheduling-api';

/*
 * Wise's scheduling cards (DESIGN.md §7.3): the day's appointments and the queue (read), and the booking and
 * reschedule drafts. The draft names the doctor and the day; the front desk picks the slot from the doctor's open
 * slots and confirms. Only Confirm calls `bookAppointment` / `rescheduleAppointment`, with the card's `wiseOrigin`.
 */

/** The clinic's doctor the model named ("Reyes"), or '' when none or several match. */
function useNamedDoctor(clinicId: string | null, words: string | undefined): string {
	const doctors = useClinicDoctors(clinicId);
	const wanted = (words ?? '')
		.toLowerCase()
		.replace(/\b(dra?|doctor|doc)\.?\s+/g, '')
		.split(/\s+/)
		.filter(Boolean);
	const matches =
		wanted.length === 0
			? []
			: (doctors.data ?? []).filter((doctor) => wanted.every((word) => doctor.name.toLowerCase().includes(word)));
	return matches.length === 1 ? matches[0].id : '';
}

/** `propose_appointment`: a booking for the chart's patient with a doctor of the clinic, saved with `bookAppointment`. */
export const ProposeAppointmentToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_appointment'>) => (
	<ActionFrame<ProposeAppointmentInput> toolPart={toolPart}>
		{(input, output) => <AppointmentCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function AppointmentCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeAppointmentInput;
	output: ActionOutput;
}) {
	const { clinicId } = useSchedulingClinic();
	const patient = useQuery({
		...patientApi.patient.get.queryOptions({ id: output.patientId ?? '' }),
		enabled: Boolean(output.patientId),
	});
	const named = useNamedDoctor(clinicId, input.doctor);
	if (patient.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (!patient.data) {
		return <ErrorMessage message="Wise named a patient you can't see." />;
	}
	return (
		<BookingBody
			key={named}
			toolPart={toolPart}
			clinicId={clinicId}
			patientId={patient.data.id}
			patientName={`${patient.data.givenName} ${patient.data.familyName}`}
			input={input}
			initialDoctorId={named}
		/>
	);
}

function BookingBody({
	toolPart,
	clinicId,
	patientId,
	patientName,
	input,
	initialDoctorId,
}: {
	toolPart: ToolPart;
	clinicId: string | null;
	patientId: string;
	patientName: string;
	input: ProposeAppointmentInput;
	initialDoctorId: string;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [doctorId, setDoctorId] = useState(initialDoctorId);
	const [date, setDate] = useState(validDate(input.date));
	const [start, setStart] = useState<string | null>(null);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const visitType = input.visitType ?? 'NEW_PATIENT';
	const channel = input.channel ?? 'PHONE';

	const confirm = async ({ origin }: ProposalConfirm) => {
		if (!clinicId || !start || !doctorId) {
			setError('Pick the doctor and a slot first.');
			return;
		}
		setPending(true);
		setError(undefined);
		try {
			const booked = await schedulingApi.book.mutate({
				clinicId,
				patientId,
				practitionerId: doctorId,
				scheduledStart: start,
				visitType,
				channel,
				reason: input.reason ?? null,
				wiseOrigin: {
					...origin,
					edited:
						doctorId !== initialDoctorId || date !== input.date || (input.time ?? '') !== manilaTime(start),
				},
			});
			void queryClient.invalidateQueries(schedulingApi.invalidate);
			void queueOrSendMessage({
				text: `I booked ${patientName} with ${booked.practitioner.name} on ${dayLabel(date)} at ${manilaTime(booked.scheduledStart)}.`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'The booking failed.');
			throw caught;
		} finally {
			setPending(false);
		}
	};

	return (
		<ActionCard
			toolPart={toolPart}
			icon={CalendarPlus}
			title={`Book ${patientName}`}
			confirmLabel='Book'
			resolved='Booked'
			answer='I booked'
			onConfirm={confirm}
			isPending={pending}
			isConfirmDisabled={!start || !doctorId}
			error={error}
		>
			<p className={styles.meta}>
				{VISIT_TYPE_LABELS[visitType]} · {CHANNEL_LABELS[channel]}
				{input.reason && ` · ${input.reason}`}
			</p>
			<div className={styles.grid}>
				<FormField label='Doctor'>
					{() => (
						<DoctorSelect
							clinicId={clinicId}
							value={doctorId}
							onChange={(value) => {
								setDoctorId(value);
								setStart(null);
							}}
						/>
					)}
				</FormField>
				<FormField label='Day'>
					{(id) => (
						<Input
							id={id}
							type='date'
							value={date}
							onChange={(event) => {
								setDate(event.target.value);
								setStart(null);
							}}
						/>
					)}
				</FormField>
			</div>
			<FormField label={input.time ? `Time (asked for ${input.time})` : 'Time'}>
				{() => (
					<SlotPicker
						clinicId={clinicId}
						practitionerId={doctorId}
						date={date}
						value={start}
						onChange={setStart}
						partOfDay={input.time ? undefined : input.partOfDay}
					/>
				)}
			</FormField>
		</ActionCard>
	);
}

/** `propose_reschedule`: moves one of the patient's bookings, saved with `rescheduleAppointment`. */
export const ProposeRescheduleToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_reschedule'>) => (
	<ActionFrame<ProposeRescheduleInput> toolPart={toolPart}>
		{(input, output) => <RescheduleCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function RescheduleCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeRescheduleInput;
	output: ActionOutput;
}) {
	const { clinicId } = useSchedulingClinic();
	const appointment = useQuery({
		...schedulingApi.appointment.queryOptions({ appointmentId: output.subjectId ?? '' }),
		enabled: Boolean(output.subjectId),
	});
	const named = useNamedDoctor(clinicId, input.doctor);
	if (appointment.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (appointment.error) {
		return <ErrorMessage message={appointment.error.message} />;
	}
	if (output.patientId && appointment.data.patientId !== output.patientId) {
		return <ErrorMessage message="Wise named a booking that isn't this patient's." />;
	}
	return (
		<RescheduleBody
			key={named}
			toolPart={toolPart}
			clinicId={clinicId}
			appointment={appointment.data}
			input={input}
			initialDoctorId={named || appointment.data.practitionerId}
		/>
	);
}

function RescheduleBody({
	toolPart,
	clinicId,
	appointment,
	input,
	initialDoctorId,
}: {
	toolPart: ToolPart;
	clinicId: string | null;
	appointment: AppointmentFieldsFragment;
	input: ProposeRescheduleInput;
	initialDoctorId: string;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [doctorId, setDoctorId] = useState(initialDoctorId);
	const [date, setDate] = useState(validDate(input.date));
	const [start, setStart] = useState<string | null>(null);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const was = `${dayLabel(manilaDate(new Date(appointment.scheduledStart)))} ${manilaTime(appointment.scheduledStart)}, ${appointment.practitioner.name}`;
	const movable = appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED';

	const confirm = async ({ origin }: ProposalConfirm) => {
		if (!start) {
			setError('Pick the new slot first.');
			return;
		}
		setPending(true);
		setError(undefined);
		try {
			const moved = await schedulingApi.reschedule.mutate({
				appointmentId: appointment.id,
				scheduledStart: start,
				practitionerId: doctorId === appointment.practitionerId ? null : doctorId,
				reason: input.reason ?? null,
				wiseOrigin: { ...origin, edited: doctorId !== initialDoctorId || date !== input.date },
			});
			void queryClient.invalidateQueries(schedulingApi.invalidate);
			void queueOrSendMessage({
				text: `I moved ${appointment.patient.name}'s booking to ${dayLabel(date)} at ${manilaTime(moved.scheduledStart)} with ${moved.practitioner.name}.`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'The reschedule failed.');
			throw caught;
		} finally {
			setPending(false);
		}
	};

	return (
		<ActionCard
			toolPart={toolPart}
			icon={CalendarClock}
			title={`Reschedule ${appointment.patient.name}`}
			confirmLabel='Move booking'
			resolved='Rescheduled'
			answer='I moved'
			onConfirm={confirm}
			isPending={pending}
			isConfirmDisabled={!start || !movable}
			error={
				error ??
				(movable
					? undefined
					: `This booking is ${APPOINTMENT_STATUS[appointment.status].label.toLowerCase()}; it can't be moved.`)
			}
		>
			<p className={styles.meta}>
				Now: {was}
				{input.reason && ` · ${input.reason}`}
			</p>
			<div className={styles.grid}>
				<FormField label='Doctor'>
					{() => (
						<DoctorSelect
							clinicId={clinicId}
							value={doctorId}
							onChange={(value) => {
								setDoctorId(value);
								setStart(null);
							}}
						/>
					)}
				</FormField>
				<FormField label='New day'>
					{(id) => (
						<Input
							id={id}
							type='date'
							value={date}
							onChange={(event) => {
								setDate(event.target.value);
								setStart(null);
							}}
						/>
					)}
				</FormField>
			</div>
			<FormField label={input.time ? `New time (asked for ${input.time})` : 'New time'}>
				{() => (
					<SlotPicker
						clinicId={clinicId}
						practitionerId={doctorId}
						date={date}
						value={start}
						onChange={setStart}
						partOfDay={input.time ? undefined : input.partOfDay}
					/>
				)}
			</FormField>
		</ActionCard>
	);
}

/** `list_appointments`: the day's bookings Wise read, with a link to the calendar. */
export const ListAppointmentsToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_appointments'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listAppointments.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='appointments'>
			<p className={styles.resultsTitle}>
				<CalendarDays aria-hidden /> {dayLabel(output.date)}
				{output.doctor && ` · ${output.doctor}`} ({output.appointments.length}
				{output.truncated && '+'})
				<Link to='/appointments' search={{ date: output.date }} className={styles.link}>
					Open the calendar
				</Link>
			</p>
			{output.appointments.length === 0 ? (
				<p className={styles.meta}>No bookings.</p>
			) : (
				<ul className={styles.list}>
					{output.appointments.map((appointment) => (
						<li key={appointment.id}>
							<strong>{appointment.time}</strong> · {appointment.patient.name} · {appointment.doctor.name}{' '}
							·{' '}
							{APPOINTMENT_STATUS[appointment.status as keyof typeof APPOINTMENT_STATUS]?.label ??
								appointment.status}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

/** `list_queue`: who's next, in call order, with a link to the queue. */
export const ListQueueToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_queue'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listQueue.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='queue'>
			<p className={styles.resultsTitle}>
				<ListOrdered aria-hidden /> Queue · {output.waiting} waiting{output.next && ` · next ${output.next}`}
				<Link to='/queue' className={styles.link}>
					Open the queue
				</Link>
			</p>
			{output.tickets.length === 0 ? (
				<p className={styles.meta}>Nobody in line.</p>
			) : (
				<ul className={styles.list}>
					{output.tickets.map((ticket) => (
						<li key={ticket.code}>
							<strong>{ticket.code}</strong> · {ticket.patient?.name ?? 'Patient'} · {ticket.stationLabel}{' '}
							· {QUEUE_STATUS[ticket.status as keyof typeof QUEUE_STATUS]?.label ?? ticket.status}
							{ticket.priorityReason &&
								` · ${PRIORITY_REASON_LABELS[ticket.priorityReason as keyof typeof PRIORITY_REASON_LABELS] ?? ticket.priorityReason}`}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

/** The model's date when it is one, else today (Manila). */
function validDate(value: string | undefined): string {
	return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : manilaDate();
}
