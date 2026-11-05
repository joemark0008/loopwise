import { useDebouncedValue } from '@mantine/hooks';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './scheduling.module.css';
import { APPOINTMENT_STATUS, manilaTime, QUEUE_STATUS } from './scheduling-format';
import type {
	AppointmentStatus,
	PatientFieldsFragment,
	QueueStatus,
	QueueTicketFieldsFragment,
} from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { patientApi } from '@/lib/patient-api';
import { schedulingApi } from '@/lib/scheduling-api';
import { cn } from '@/lib/utils';

/** The clinic the desk works at: the selected clinic. */
export function useSchedulingClinic() {
	const clinic = useCurrentClinic();
	return { clinicId: clinic.data?.id ?? null, clinicName: clinic.data?.name ?? '', isPending: clinic.isPending };
}

/** The doctors holding clinic at the clinic, with their room there. */
export function useClinicDoctors(clinicId: string | null) {
	return useQuery(
		schedulingApi.practitioners.queryOptions(clinicId ? { clinicId } : skipToken, {
			select: (doctors) =>
				doctors.map((doctor) => ({
					id: doctor.id,
					name: doctor.displayName,
					userId: doctor.userId ?? null,
					roomName: doctor.clinics.find((entry) => entry.clinicId === clinicId)?.roomName ?? null,
				})),
		}),
	);
}

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
	const { label, tone } = APPOINTMENT_STATUS[status];
	return <ClinicalFlag tone={tone}>{label}</ClinicalFlag>;
}

export function QueueStatusBadge({ status }: { status: QueueStatus }) {
	const { label, tone } = QUEUE_STATUS[status];
	return <ClinicalFlag tone={tone}>{label}</ClinicalFlag>;
}

/** "A-007", the priority lane's in the critical colour with its word for screen readers. */
export function TicketCode({ ticket }: { ticket: Pick<QueueTicketFieldsFragment, 'code' | 'isPriority'> }) {
	return (
		<span className={cn(styles.code, ticket.isPriority && styles.priorityCode)} data-testid='ticket-code'>
			{ticket.code}
			{ticket.isPriority && <span className='sr-only'> (priority lane)</span>}
		</span>
	);
}

/** A doctor of the clinic, or every doctor when `allLabel` is given. */
export function DoctorSelect({
	clinicId,
	value,
	onChange,
	allLabel,
	disabled,
	label = 'Doctor',
}: {
	clinicId: string | null;
	value: string;
	onChange: (value: string) => void;
	allLabel?: string;
	disabled?: boolean;
	label?: string;
}) {
	const doctors = useClinicDoctors(clinicId);
	return (
		<Select value={value} onValueChange={onChange} disabled={disabled || !doctors.data}>
			<SelectTrigger className={styles.doctorSelect} aria-label={label}>
				<SelectValue placeholder='Choose a doctor' />
			</SelectTrigger>
			<SelectContent>
				{allLabel && <SelectItem value='all'>{allLabel}</SelectItem>}
				{doctors.data?.map((doctor) => (
					<SelectItem key={doctor.id} value={doctor.id}>
						{doctor.name}
						{doctor.roomName ? ` · ${doctor.roomName}` : ''}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/** Finds a registered patient the user may see, by name or number, and picks one. */
export function PatientPicker({
	value,
	onChange,
}: {
	value: PatientFieldsFragment | null;
	onChange: (patient: PatientFieldsFragment | null) => void;
}) {
	const [search, setSearch] = useState('');
	const [query] = useDebouncedValue(search.trim(), 250);
	const patients = useQuery(
		patientApi.patient.search.queryOptions(query.length >= 2 ? { query } : skipToken, {
			placeholderData: keepPreviousData,
		}),
	);
	if (value) {
		return (
			<div className={styles.ticket}>
				<div className={styles.ticketBody}>
					<div className={styles.main}>
						{value.givenName} {value.familyName}
					</div>
					<div className={styles.muted}>{value.patientNo}</div>
				</div>
				<Button type='button' size='sm' variant='outline' onClick={() => onChange(null)}>
					Change
				</Button>
			</div>
		);
	}
	return (
		<div className={styles.form}>
			<Input
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				placeholder='Name, patient no. or PhilHealth number'
				aria-label='Find the patient'
			/>
			{patients.error && <ErrorMessage message={patients.error.message} />}
			{patients.data && (
				<ul className={styles.pickList} aria-label='Matching patients'>
					{patients.data.slice(0, 8).map((patient) => (
						<li key={patient.id}>
							<button type='button' className={styles.pickItem} onClick={() => onChange(patient)}>
								<span className={styles.main}>
									{patient.givenName} {patient.familyName}
								</span>
								<span className={styles.muted}>
									{patient.patientNo} · {patient.birthDate}
								</span>
							</button>
						</li>
					))}
					{patients.data.length === 0 && (
						<li className={styles.muted}>No patient found. Register them first.</li>
					)}
				</ul>
			)}
		</div>
	);
}

/** The doctor's open slots on a day; the chosen one is pressed. */
export function SlotPicker({
	clinicId,
	practitionerId,
	date,
	value,
	onChange,
	partOfDay,
}: {
	clinicId: string | null;
	practitionerId: string;
	date: string;
	value: string | null;
	onChange: (start: string) => void;
	/** Only the morning or afternoon slots. */
	partOfDay?: 'morning' | 'afternoon';
}) {
	const slots = useQuery(
		schedulingApi.slots.queryOptions(
			clinicId && practitionerId && date ? { clinicId, practitionerId, date } : skipToken,
		),
	);
	if (!practitionerId || !date) {
		return <p className={styles.muted}>Choose the doctor and the day to see the open slots.</p>;
	}
	if (slots.isPending) {
		return <Skeleton />;
	}
	if (slots.error) {
		return <ErrorMessage message={slots.error.message} />;
	}
	const open = slots.data.filter((slot) => {
		const hour = Number(manilaTime(slot.start).slice(0, 2));
		return slot.status === 'OPEN' && (!partOfDay || (partOfDay === 'morning' ? hour < 12 : hour >= 12));
	});
	if (slots.data.length === 0) {
		return <p className={styles.muted}>The doctor has no clinic hours here that day.</p>;
	}
	if (open.length === 0) {
		return <p className={styles.muted}>No open slot that day: the sessions are booked, full or on leave.</p>;
	}
	return (
		<div className={styles.slots} role='group' aria-label='Open slots'>
			{open.map((slot) => (
				<Button
					key={slot.start}
					type='button'
					size='sm'
					variant={value === slot.start ? 'default' : 'outline'}
					className={styles.slot}
					aria-pressed={value === slot.start}
					onClick={() => onChange(slot.start)}
				>
					{manilaTime(slot.start)}
				</Button>
			))}
		</div>
	);
}
