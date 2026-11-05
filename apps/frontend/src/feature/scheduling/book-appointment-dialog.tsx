import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './scheduling.module.css';
import { CHANNEL_LABELS, dayLabel, manilaDate, manilaTime, VISIT_TYPE_LABELS } from './scheduling-format';
import { DoctorSelect, PatientPicker, SlotPicker } from './scheduling-parts';
import type {
	AppointmentFieldsFragment,
	BookingChannel,
	PatientFieldsFragment,
	VisitType,
} from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormField } from '@/feature/encounters/form-field';
import { schedulingApi } from '@/lib/scheduling-api';

const VISIT_TYPES = Object.keys(VISIT_TYPE_LABELS) as VisitType[];
const CHANNELS = (Object.keys(CHANNEL_LABELS) as BookingChannel[]).filter((channel) => channel !== 'WALK_IN');

/**
 * Books a patient into one of a doctor's open slots, or moves a booking (`rescheduling`) to another slot: the old one
 * is kept as RESCHEDULED. Wise's `propose_appointment` card books the same way.
 */
export function BookAppointmentDialog({
	clinicId,
	open,
	onOpenChange,
	initialDate,
	initialDoctorId,
	rescheduling,
}: {
	clinicId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialDate: string;
	initialDoctorId?: string;
	rescheduling?: AppointmentFieldsFragment | null;
}) {
	const queryClient = useQueryClient();
	const [patient, setPatient] = useState<PatientFieldsFragment | null>(null);
	const [doctorId, setDoctorId] = useState(rescheduling?.practitionerId ?? initialDoctorId ?? '');
	const [date, setDate] = useState(initialDate);
	const [start, setStart] = useState<string | null>(null);
	const [visitType, setVisitType] = useState<VisitType>(rescheduling?.visitType ?? 'NEW_PATIENT');
	const [channel, setChannel] = useState<BookingChannel>(rescheduling?.channel ?? 'PHONE');
	const [reason, setReason] = useState(rescheduling?.reason ?? '');
	const done = { onSuccess: () => close(false) };
	const book = useMutation(
		schedulingApi.book.mutationOptions({
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);
	const reschedule = useMutation(
		schedulingApi.reschedule.mutationOptions({
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);
	const pending = book.isPending || reschedule.isPending;
	const error = book.error ?? reschedule.error;

	function close(next: boolean) {
		if (!next) {
			setPatient(null);
			setStart(null);
			book.reset();
			reschedule.reset();
		}
		onOpenChange(next);
	}

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!start || !clinicId) {
			return;
		}
		if (rescheduling) {
			reschedule.mutate(
				{
					appointmentId: rescheduling.id,
					scheduledStart: start,
					practitionerId: doctorId === rescheduling.practitionerId ? null : doctorId,
					reason: reason.trim() || null,
				},
				done,
			);
		} else if (patient) {
			book.mutate(
				{
					clinicId,
					patientId: patient.id,
					practitionerId: doctorId,
					scheduledStart: start,
					visitType,
					channel,
					reason: reason.trim() || null,
				},
				done,
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<form onSubmit={submit} noValidate className={styles.form}>
					<DialogHeader>
						<DialogTitle>{rescheduling ? 'Reschedule' : 'Book an appointment'}</DialogTitle>
						<DialogDescription>
							{rescheduling
								? `${rescheduling.patient.name}, now ${dayLabel(manilaDate(new Date(rescheduling.scheduledStart)))} ${manilaTime(rescheduling.scheduledStart)}. Pick the new slot.`
								: "Pick the patient, the doctor and one of the doctor's open slots."}
						</DialogDescription>
					</DialogHeader>
					{!rescheduling && (
						<FormField label='Patient'>
							{() => <PatientPicker value={patient} onChange={setPatient} />}
						</FormField>
					)}
					<div className={styles.fields}>
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
						{!rescheduling && (
							<>
								<FormField label='Visit'>
									{() => (
										<Select
											value={visitType}
											onValueChange={(value) => setVisitType(value as VisitType)}
										>
											<SelectTrigger aria-label='Visit'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{VISIT_TYPES.map((type) => (
													<SelectItem key={type} value={type}>
														{VISIT_TYPE_LABELS[type]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</FormField>
								<FormField label='Booked by'>
									{() => (
										<Select
											value={channel}
											onValueChange={(value) => setChannel(value as BookingChannel)}
										>
											<SelectTrigger aria-label='Booked by'>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{CHANNELS.map((option) => (
													<SelectItem key={option} value={option}>
														{CHANNEL_LABELS[option]}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</FormField>
							</>
						)}
					</div>
					<FormField label='Time'>
						{() => (
							<SlotPicker
								clinicId={clinicId}
								practitionerId={doctorId}
								date={date}
								value={start}
								onChange={setStart}
							/>
						)}
					</FormField>
					<FormField label={rescheduling ? 'Why' : 'Reason for the visit'}>
						{(id) => (
							<Input
								id={id}
								value={reason}
								placeholder={rescheduling ? 'Patient asked to move it' : 'BP follow-up'}
								onChange={(event) => setReason(event.target.value)}
							/>
						)}
					</FormField>
					{error && <ErrorMessage message={error.message} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={pending || !start || (!rescheduling && !patient)}>
							{rescheduling ? 'Move booking' : 'Book'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
