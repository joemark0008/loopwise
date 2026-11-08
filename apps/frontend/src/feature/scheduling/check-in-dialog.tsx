import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { useState } from 'react';
import { manilaTime, PRIORITY_REASON_LABELS, VISIT_TYPE_LABELS } from './scheduling-format';
import { DoctorSelect, PatientPicker } from './scheduling-parts';
import type {
	AppointmentFieldsFragment,
	PatientFieldsFragment,
	PriorityReason,
	QueueStation,
	QueueTicketFieldsFragment,
	VisitType,
} from '@/graphql/generated/graphql';
import { Avatar } from '@/components/ui/avatar';
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
import { cn } from '@/lib/utils';

const PRIORITY_REASONS = Object.keys(PRIORITY_REASON_LABELS) as PriorityReason[];
const VISIT_TYPES = Object.keys(VISIT_TYPE_LABELS) as VisitType[];

/**
 * Checks a patient in: today's booking (`appointment`) or a walk-in. Opens the visit and issues the queue number; the
 * priority lane (seniors, PWDs, pregnant, with an infant, emergency) gets a "P" number and is called first.
 */
export function CheckInDialog({
	clinicId,
	appointment,
	open,
	onOpenChange,
	onCheckedIn,
}: {
	clinicId: string | null;
	/** Today's booking; a walk-in when absent. */
	appointment?: AppointmentFieldsFragment | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCheckedIn?: (ticket: QueueTicketFieldsFragment) => void;
}) {
	const queryClient = useQueryClient();
	const [patient, setPatient] = useState<PatientFieldsFragment | null>(null);
	const [doctorId, setDoctorId] = useState('');
	const [visitType, setVisitType] = useState<VisitType>('NEW_PATIENT');
	const [priority, setPriority] = useState<PriorityReason | 'none'>('none');
	const [station, setStation] = useState<QueueStation>('TRIAGE');
	const [reason, setReason] = useState(appointment?.reason ?? '');
	const checkIn = useMutation(
		schedulingApi.checkIn.mutationOptions({
			onSettled: () => queryClient.invalidateQueries(schedulingApi.invalidate),
		}),
	);

	function close(next: boolean) {
		if (!next) {
			setPatient(null);
			setPriority('none');
			checkIn.reset();
		}
		onOpenChange(next);
	}

	const ready = Boolean(clinicId) && (appointment ? true : Boolean(patient && doctorId));
	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!ready || !clinicId) {
			return;
		}
		checkIn.mutate(
			{
				clinicId,
				...(appointment
					? { appointmentId: appointment.id }
					: { patientId: patient!.id, practitionerId: doctorId, visitType }),
				reason: reason.trim() || null,
				priorityReason: priority === 'none' ? null : priority,
				station,
			},
			{
				onSuccess: (ticket) => {
					onCheckedIn?.(ticket);
					close(false);
				},
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className='sm:max-w-xl'>
				<form onSubmit={submit} noValidate className='flex flex-col gap-5'>
					<DialogHeader>
						<DialogTitle>
							{appointment ? `Check in ${appointment.patient.name}` : 'Check in a walk-in'}
						</DialogTitle>
						<DialogDescription>
							{appointment
								? 'Opens the visit and gives a queue number.'
								: 'For a registered patient. Opens the visit and gives a queue number.'}
						</DialogDescription>
					</DialogHeader>
					{appointment ? (
						<div className='flex items-center gap-3 rounded-lg border bg-muted/40 p-3'>
							<Avatar username={appointment.patient.name} size='lg' decorative />
							<div className='min-w-0 flex-1'>
								<p className='truncate font-semibold text-foreground'>{appointment.patient.name}</p>
								<p className='text-xs text-muted-foreground'>
									Booked {manilaTime(appointment.scheduledStart)} with {appointment.practitioner.name}
								</p>
							</div>
						</div>
					) : (
						<>
							<FormField label='Patient'>
								{() => <PatientPicker value={patient} onChange={setPatient} />}
							</FormField>
							<div className='grid gap-4 sm:grid-cols-2'>
								<FormField label="Doctor's line">
									{() => (
										<DoctorSelect
											clinicId={clinicId}
											value={doctorId}
											onChange={setDoctorId}
											label="Doctor's line"
											className='sm:w-full sm:min-w-0'
										/>
									)}
								</FormField>
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
							</div>
						</>
					)}
					<div className='grid gap-4 sm:grid-cols-2'>
						<FormField label='Priority lane'>
							{() => (
								<Select
									value={priority}
									onValueChange={(value) => setPriority(value as PriorityReason | 'none')}
								>
									<SelectTrigger aria-label='Priority lane' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='none'>Regular (A)</SelectItem>
										{PRIORITY_REASONS.map((option) => (
											<SelectItem key={option} value={option}>
												{PRIORITY_REASON_LABELS[option]} (P)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</FormField>
						<FormField label='First stop'>
							{() => (
								<Select value={station} onValueChange={(value) => setStation(value as QueueStation)}>
									<SelectTrigger aria-label='First stop' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='TRIAGE'>Triage (nurse)</SelectItem>
										<SelectItem value='DOCTOR'>Straight to the doctor</SelectItem>
									</SelectContent>
								</Select>
							)}
						</FormField>
					</div>
					<p
						className={cn(
							'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm',
							priority === 'none' ? 'bg-muted/60 text-muted-foreground' : 'bg-critical-bg text-critical',
						)}
					>
						<Ticket className='mt-0.5 size-4 shrink-0' aria-hidden />
						{priority === 'none'
							? `Gets an A number and joins the ${station === 'TRIAGE' ? 'triage' : "doctor's"} line in turn.`
							: `Gets a P number and is called before the regular lane (${PRIORITY_REASON_LABELS[priority]}).`}
					</p>
					<FormField label='Reason for the visit'>
						{(id) => (
							<Input
								id={id}
								value={reason}
								placeholder='Cough for 3 days'
								onChange={(event) => setReason(event.target.value)}
							/>
						)}
					</FormField>
					{checkIn.error && <ErrorMessage message={checkIn.error.message} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={!ready || checkIn.isPending}>
							Check in
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
