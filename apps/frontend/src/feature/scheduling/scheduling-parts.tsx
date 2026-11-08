import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { Clock, Search } from 'lucide-react';
import { useState } from 'react';
import { LONG_WAIT_MIN, minutesSince } from './queue-summary';
import { APPOINTMENT_STATUS, manilaTime, QUEUE_STATUS, waited } from './scheduling-format';
import type {
	AppointmentStatus,
	PatientFieldsFragment,
	QueueStatus,
	QueueTicketFieldsFragment,
} from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { Avatar } from '@/components/ui/avatar';
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

/**
 * "A-007" on a number tile, the priority lane's in the critical colour with its word for screen readers. `lg` for the
 * patient at a desk.
 */
export function TicketCode({
	ticket,
	size = 'md',
	className,
}: {
	ticket: Pick<QueueTicketFieldsFragment, 'code' | 'isPriority'>;
	size?: 'md' | 'lg';
	className?: string;
}) {
	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center justify-center rounded-lg font-display font-semibold whitespace-nowrap tabular-nums',
				size === 'lg' ? 'min-w-24 px-3.5 py-2.5 text-2xl' : 'min-w-[4.5rem] px-2.5 py-1.5 text-base',
				ticket.isPriority ? 'bg-critical-bg text-critical' : 'bg-muted text-foreground',
				className,
			)}
			data-testid='ticket-code'
		>
			{ticket.code}
			{ticket.isPriority && <span className='sr-only'> (priority lane)</span>}
		</span>
	);
}

/** How long a ticket has waited; past half an hour in the warning colour. */
export function WaitTime({ since, srPrefix = 'Waited ' }: { since: string; srPrefix?: string | null }) {
	const long = minutesSince(since) >= LONG_WAIT_MIN;
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 text-xs whitespace-nowrap tabular-nums',
				long ? 'font-medium text-abnormal' : 'text-muted-foreground',
			)}
		>
			<Clock className='size-3.5' aria-hidden />
			{srPrefix && <span className='sr-only'>{srPrefix}</span>}
			{waited(since)}
		</span>
	);
}

export interface Stat {
	label: string;
	value: number | undefined;
	hint?: ReactNode;
}

/** A row of the day's figures, two by two on a phone. */
export function StatStrip({ stats, label }: { stats: Stat[]; label: string }) {
	return (
		<div
			role='group'
			aria-label={label}
			className='grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4'
		>
			{stats.map((stat) => (
				<div key={stat.label} className='flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 lg:px-5'>
					<p className='text-sm text-muted-foreground'>{stat.label}</p>
					<div className='font-display text-2xl font-semibold text-foreground tabular-nums'>
						{stat.value === undefined ? <Skeleton className='h-8 w-10' /> : stat.value}
					</div>
					{stat.hint && <p className='text-xs text-muted-foreground'>{stat.hint}</p>}
				</div>
			))}
		</div>
	);
}

/** A titled group of ticket cards on the page itself (no panel around the cards): a heading, its count, the list. */
export function QueueSection({
	id,
	title,
	count,
	aside,
	children,
}: {
	id: string;
	title: string;
	count: number;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<section className='flex flex-col gap-3' aria-labelledby={id}>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 id={id} className='text-base font-semibold text-foreground'>
					{title} <span className='font-normal text-muted-foreground tabular-nums'>({count})</span>
				</h2>
				{aside}
			</div>
			{children}
		</section>
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
	className,
}: {
	clinicId: string | null;
	value: string;
	onChange: (value: string) => void;
	allLabel?: string;
	disabled?: boolean;
	label?: string;
	className?: string;
}) {
	const doctors = useClinicDoctors(clinicId);
	return (
		<Select value={value} onValueChange={onChange} disabled={disabled || !doctors.data}>
			<SelectTrigger className={cn('w-full min-w-0 sm:w-auto sm:min-w-52', className)} aria-label={label}>
				<SelectValue placeholder='Choose a doctor' />
			</SelectTrigger>
			<SelectContent>
				{allLabel && <SelectItem value='all'>{allLabel}</SelectItem>}
				{doctors.data?.map((doctor) => (
					<SelectItem key={doctor.id} value={doctor.id}>
						{doctor.name}
						{doctor.roomName && <span className='text-muted-foreground'>{doctor.roomName}</span>}
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
	const query = useDebouncedValue(search.trim(), 250);
	const patients = useQuery(
		patientApi.patient.search.queryOptions(query.length >= 2 ? { query } : skipToken, {
			placeholderData: keepPreviousData,
		}),
	);
	if (value) {
		const name = `${value.givenName} ${value.familyName}`;
		return (
			<div className='flex items-center gap-3 rounded-lg border bg-muted/40 p-3'>
				<Avatar username={name} size='lg' decorative />
				<div className='min-w-0 flex-1'>
					<p className='truncate font-semibold text-foreground'>{name}</p>
					<p className='text-xs text-muted-foreground'>
						{value.patientNo}, born {value.birthDate}
					</p>
				</div>
				<Button type='button' size='sm' variant='outline' onClick={() => onChange(null)}>
					Change
				</Button>
			</div>
		);
	}
	return (
		<div className='flex flex-col gap-2'>
			<div className='relative'>
				<Search
					className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground'
					aria-hidden
				/>
				<Input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder='Name, patient no. or PhilHealth number'
					aria-label='Find the patient'
					className='pl-9'
				/>
			</div>
			{search.trim().length < 2 && (
				<p className='text-xs text-muted-foreground'>Type at least two letters of the name or number.</p>
			)}
			{patients.error && <ErrorMessage message={patients.error.message} />}
			{patients.data && search.trim().length >= 2 && (
				<ul
					className='flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border p-1'
					aria-label='Matching patients'
				>
					{patients.data.slice(0, 8).map((patient) => {
						const name = `${patient.givenName} ${patient.familyName}`;
						return (
							<li key={patient.id}>
								<button
									type='button'
									className='flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-muted'
									onClick={() => onChange(patient)}
								>
									<Avatar username={name} size='sm' decorative />
									<span className='min-w-0 flex-1 truncate font-medium'>{name}</span>
									<span className='flex flex-col items-end text-xs whitespace-nowrap text-muted-foreground tabular-nums'>
										<span>{patient.patientNo}</span>
										<span>born {patient.birthDate}</span>
									</span>
								</button>
							</li>
						);
					})}
					{patients.data.length === 0 && (
						<li className='px-2.5 py-2 text-sm text-muted-foreground'>
							No patient found. Register them first.
						</li>
					)}
				</ul>
			)}
		</div>
	);
}

const PARTS_OF_DAY = [
	{ key: 'morning', label: 'Morning', from: 0, to: 12 },
	{ key: 'afternoon', label: 'Afternoon', from: 12, to: 17 },
	{ key: 'evening', label: 'Evening', from: 17, to: 24 },
] as const;

/** The doctor's open slots on a day, by part of the day; the chosen one is pressed. */
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
		return <SlotNote>Choose the doctor and the day to see the open slots.</SlotNote>;
	}
	if (slots.isPending) {
		return (
			<div className='grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5'>
				{Array.from({ length: 8 }, (_, index) => (
					<Skeleton key={index} className='h-8' />
				))}
			</div>
		);
	}
	if (slots.error) {
		return <ErrorMessage message={slots.error.message} />;
	}
	const hourOf = (start: string) => Number(manilaTime(start).slice(0, 2));
	const open = slots.data.filter((slot) => {
		const hour = hourOf(slot.start);
		return slot.status === 'OPEN' && (!partOfDay || (partOfDay === 'morning' ? hour < 12 : hour >= 12));
	});
	if (slots.data.length === 0) {
		return <SlotNote>The doctor has no clinic hours here that day.</SlotNote>;
	}
	if (open.length === 0) {
		return <SlotNote>No open slot that day: the sessions are booked, full or on leave.</SlotNote>;
	}
	const parts = PARTS_OF_DAY.map((part) => ({
		...part,
		slots: open.filter((slot) => hourOf(slot.start) >= part.from && hourOf(slot.start) < part.to),
	})).filter((part) => part.slots.length > 0);
	return (
		<div className='flex flex-col gap-3' role='group' aria-label='Open slots'>
			{parts.map((part) => (
				<div key={part.key} className='flex flex-col gap-1.5'>
					<p className='text-xs text-muted-foreground'>
						<span className='font-medium text-foreground'>{part.label}</span>, {part.slots.length} open
					</p>
					<div className='grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5'>
						{part.slots.map((slot) => (
							<Button
								key={slot.start}
								type='button'
								size='sm'
								variant={value === slot.start ? 'default' : 'outline'}
								className='tabular-nums'
								aria-pressed={value === slot.start}
								onClick={() => onChange(slot.start)}
							>
								{manilaTime(slot.start)}
							</Button>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function SlotNote({ children }: { children: ReactNode }) {
	return (
		<p className='rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground'>
			{children}
		</p>
	);
}
