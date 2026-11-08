import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CHANNEL_LABELS, dayLabel, manilaDate, manilaTime, VISIT_TYPE_LABELS } from './scheduling-format';
import { DoctorSelect, PatientPicker, SlotPicker, useClinicDoctors } from './scheduling-parts';
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
 * is kept as RESCHEDULED. Wise's `propose_appointment` card books the same way. The follow-up list opens it with the
 * patient, the doctor, the suggested day, FOLLOW_UP and the reason filled in (`initialPatient`, `initialVisitType`,
 * `initialReason`); the desk can change any of them.
 */
export function BookAppointmentDialog({
	clinicId,
	open,
	onOpenChange,
	initialDate,
	initialDoctorId,
	initialPatient,
	initialVisitType,
	initialReason,
	rescheduling,
}: {
	clinicId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialDate: string;
	initialDoctorId?: string;
	initialPatient?: PatientFieldsFragment | null;
	initialVisitType?: VisitType;
	initialReason?: string;
	rescheduling?: AppointmentFieldsFragment | null;
}) {
	const queryClient = useQueryClient();
	const [patient, setPatient] = useState<PatientFieldsFragment | null>(initialPatient ?? null);
	const [doctorId, setDoctorId] = useState(rescheduling?.practitionerId ?? initialDoctorId ?? '');
	const [date, setDate] = useState(initialDate);
	const [start, setStart] = useState<string | null>(null);
	const [visitType, setVisitType] = useState<VisitType>(rescheduling?.visitType ?? initialVisitType ?? 'NEW_PATIENT');
	const [channel, setChannel] = useState<BookingChannel>(rescheduling?.channel ?? 'PHONE');
	const [reason, setReason] = useState(rescheduling?.reason ?? initialReason ?? '');
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
			setPatient(initialPatient ?? null);
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

	const doctors = useClinicDoctors(clinicId);
	const doctorName = doctors.data?.find((doctor) => doctor.id === doctorId)?.name;
	const who = rescheduling?.patient.name ?? (patient ? `${patient.givenName} ${patient.familyName}` : null);

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className='sm:max-w-3xl'>
				<form onSubmit={submit} noValidate className='flex flex-col gap-5'>
					<DialogHeader>
						<DialogTitle>{rescheduling ? 'Reschedule' : 'Book an appointment'}</DialogTitle>
						<DialogDescription>
							{rescheduling
								? `${rescheduling.patient.name}, now ${dayLabel(manilaDate(new Date(rescheduling.scheduledStart)))} ${manilaTime(rescheduling.scheduledStart)}. Pick the new slot.`
								: "Pick the patient, the doctor and one of the doctor's open slots."}
						</DialogDescription>
					</DialogHeader>
					<div className='grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
						<div className='flex min-w-0 flex-col gap-4'>
							{!rescheduling && (
								<FormField label='Patient'>
									{() => <PatientPicker value={patient} onChange={setPatient} />}
								</FormField>
							)}
							<FormField label='Doctor'>
								{() => (
									<DoctorSelect
										clinicId={clinicId}
										value={doctorId}
										className='sm:w-full'
										onChange={(value) => {
											setDoctorId(value);
											setStart(null);
										}}
									/>
								)}
							</FormField>
							{!rescheduling && (
								<div className='grid gap-4 sm:grid-cols-2'>
									<FormField label='Visit'>
										{() => (
											<Select
												value={visitType}
												onValueChange={(value) => setVisitType(value as VisitType)}
											>
												<SelectTrigger aria-label='Visit' className='w-full'>
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
												<SelectTrigger aria-label='Booked by' className='w-full'>
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
								</div>
							)}
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
						</div>
						<div className='flex min-w-0 flex-col gap-2 md:border-l md:pl-6'>
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
							<p className='mt-2 text-sm font-medium text-foreground'>Time</p>
							<div className='md:max-h-80 md:overflow-y-auto md:pr-1'>
								<SlotPicker
									clinicId={clinicId}
									practitionerId={doctorId}
									date={date}
									value={start}
									onChange={setStart}
								/>
							</div>
						</div>
					</div>
					{error && <ErrorMessage message={error.message} />}
					<DialogFooter className='flex-col sm:items-center sm:justify-between'>
						<p className='text-sm text-muted-foreground' aria-live='polite'>
							{start && who && doctorName ? (
								<>
									<span className='font-medium text-foreground'>{who}</span> with {doctorName},{' '}
									{dayLabel(date)} at{' '}
									<span className='font-medium text-foreground'>{manilaTime(start)}</span>
								</>
							) : (
								'Choose a time to book.'
							)}
						</p>
						<div className='flex justify-end gap-2'>
							<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
								Cancel
							</Button>
							<Button type='submit' disabled={pending || !start || (!rescheduling && !patient)}>
								{rescheduling ? 'Move booking' : 'Book'}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
