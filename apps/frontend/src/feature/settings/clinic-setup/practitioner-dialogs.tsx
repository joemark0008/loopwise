import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './clinic-setup.module.css';
import { DAY_NAMES, Field, numberOrNull, orNull } from './setup-form';
import type { ClinicPractitioner, SetupPractitioner } from '@/lib/clinic-setup-api';
import type { PractitionerType } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { clinicSetupApi } from '@/lib/clinic-setup-api';

const TYPE_LABELS: Record<PractitionerType, string> = {
	PHYSICIAN: 'Physician',
	DENTIST: 'Dentist',
	MIDWIFE: 'Midwife',
	NURSE: 'Nurse',
	PSYCHOLOGIST: 'Psychologist',
	PHYSICAL_THERAPIST: 'Physical therapist',
	NUTRITIONIST_DIETITIAN: 'Nutritionist-dietitian',
	OPTOMETRIST: 'Optometrist',
	OTHER: 'Other',
};

const NO_USER = '__none__';

/** The dialog a practitioner card opens: the profile, room and fee, a weekly session, or a leave. */
export type PractitionerDialogState =
	| { kind: 'profile'; practitioner: SetupPractitioner | null }
	| { kind: 'link'; entry: ClinicPractitioner }
	| { kind: 'schedule'; entry: ClinicPractitioner }
	| { kind: 'leave'; entry: ClinicPractitioner };

export function PractitionerDialogs({
	state,
	onClose,
}: {
	state: PractitionerDialogState | null;
	onClose: () => void;
}) {
	const key =
		state === null
			? 'closed'
			: `${state.kind}-${state.kind === 'profile' ? (state.practitioner?.id ?? 'new') : state.entry.practitioner.id}`;
	return (
		<Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{state?.kind === 'profile' && (
					<ProfileForm key={key} practitioner={state.practitioner} onDone={onClose} />
				)}
				{state?.kind === 'link' && <LinkForm key={key} entry={state.entry} onDone={onClose} />}
				{state?.kind === 'schedule' && <ScheduleForm key={key} entry={state.entry} onDone={onClose} />}
				{state?.kind === 'leave' && <LeaveForm key={key} entry={state.entry} onDone={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function useRefresh(onDone: () => void) {
	const queryClient = useQueryClient();
	return async () => {
		await queryClient.invalidateQueries(clinicSetupApi.practitioners.pathFilter());
		await queryClient.invalidateQueries(clinicSetupApi.practitionerUserOptions.pathFilter());
		await queryClient.invalidateQueries(clinicSetupApi.expiries.pathFilter());
		onDone();
	};
}

const PROFILE_TEXT_FIELDS = [
	{ key: 'title', label: 'Title', placeholder: 'Dr. / Dra.' },
	{ key: 'firstName', label: 'First name', required: true },
	{ key: 'middleName', label: 'Middle name' },
	{ key: 'lastName', label: 'Last name', required: true },
	{ key: 'suffix', label: 'Suffix', placeholder: 'Jr., III' },
	{ key: 'postNominals', label: 'Post-nominals', placeholder: 'MD, FPCP' },
	{ key: 'specialty', label: 'Specialty', placeholder: 'Family medicine' },
	{ key: 'subspecialty', label: 'Subspecialty' },
	{ key: 'mobileNo', label: 'Mobile number', type: 'tel' },
	{ key: 'email', label: 'Email', type: 'email' },
	{ key: 'prcLicenseNo', label: 'PRC license number', required: true },
	{ key: 'prcLicenseExpiry', label: 'PRC license valid until', type: 'date' },
	{ key: 'ptrNo', label: 'PTR number' },
	{ key: 'ptrIssuedDate', label: 'PTR issued on', type: 'date' },
	{ key: 'ptrIssuedAt', label: 'PTR issued at', placeholder: 'Tagbilaran City' },
	{ key: 's2LicenseNo', label: 'S2 license number', placeholder: 'For dangerous drugs (RA 9165)' },
	{ key: 's2LicenseExpiry', label: 'S2 license valid until', type: 'date' },
	{ key: 'philhealthPan', label: 'PhilHealth PAN' },
	{ key: 'philhealthPanExpiry', label: 'PhilHealth PAN valid until', type: 'date' },
	{ key: 'tin', label: 'TIN', placeholder: '123-456-789-000' },
	{ key: 'signatureUrl', label: 'E-signature URL', type: 'url' },
] as const satisfies readonly {
	key: keyof SetupPractitioner;
	label: string;
	placeholder?: string;
	type?: string;
	required?: boolean;
}[];

type ProfileKey = (typeof PROFILE_TEXT_FIELDS)[number]['key'];

function ProfileForm({ practitioner, onDone }: { practitioner: SetupPractitioner | null; onDone: () => void }) {
	const [values, setValues] = useState<Record<ProfileKey, string>>(
		() =>
			Object.fromEntries(PROFILE_TEXT_FIELDS.map(({ key }) => [key, practitioner?.[key] ?? ''])) as Record<
				ProfileKey,
				string
			>,
	);
	const [type, setType] = useState<PractitionerType>(practitioner?.type ?? 'PHYSICIAN');
	const [userId, setUserId] = useState(practitioner?.userId ?? '');
	const [isActive, setIsActive] = useState(practitioner?.isActive ?? true);
	const users = useQuery({ ...clinicSetupApi.practitionerUserOptions.queryOptions({}), enabled: !practitioner });
	const save = useMutation(clinicSetupApi.savePractitioner.mutationOptions({ onSuccess: useRefresh(onDone) }));
	const valid = values.firstName.trim() && values.lastName.trim() && values.prcLicenseNo.trim().length >= 4;

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (!valid) {
					return;
				}
				save.mutate({
					...(Object.fromEntries(PROFILE_TEXT_FIELDS.map(({ key }) => [key, orNull(values[key])])) as Record<
						ProfileKey,
						string | null
					>),
					firstName: values.firstName.trim(),
					lastName: values.lastName.trim(),
					prcLicenseNo: values.prcLicenseNo.trim(),
					id: practitioner?.id ?? null,
					userId: userId || null,
					type,
					sex: practitioner?.sex ?? null,
					isActive,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>{practitioner ? `Edit ${practitioner.displayName}` : 'Add a practitioner'}</DialogTitle>
				<DialogDescription>
					Printed on the prescriptions, certificates and referrals they sign.
					{!practitioner && ' A new practitioner holds clinic here.'}
				</DialogDescription>
			</DialogHeader>
			{!practitioner && (
				<Field label='Signs in as' hint='A user of this clinic without a profile; none for a visiting doctor.'>
					{(id, describedBy) => (
						<Select
							value={userId || NO_USER}
							onValueChange={(value) => {
								const next = value === NO_USER ? '' : value;
								setUserId(next);
								const user = users.data?.find((option) => option.id === next);
								if (user) {
									setValues({
										...values,
										firstName: values.firstName || user.firstName,
										lastName: values.lastName || user.lastName,
										email: values.email || user.email,
									});
								}
							}}
						>
							<SelectTrigger id={id} aria-label='Signs in as' aria-describedby={describedBy}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_USER}>No account (visiting)</SelectItem>
								{(users.data ?? []).map((user) => (
									<SelectItem key={user.id} value={user.id}>
										{user.name} ({user.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
			)}
			<div className={styles.fields}>
				<Field label='Type'>
					{(id) => (
						<Select value={type} onValueChange={(value) => setType(value as PractitionerType)}>
							<SelectTrigger id={id} aria-label='Type'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(TYPE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				{PROFILE_TEXT_FIELDS.map((field) => (
					<Field key={field.key} label={field.label} required={'required' in field}>
						{(id) => (
							<Input
								id={id}
								type={'type' in field ? field.type : 'text'}
								placeholder={'placeholder' in field ? field.placeholder : undefined}
								value={values[field.key]}
								onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
								required={'required' in field}
							/>
						)}
					</Field>
				))}
			</div>
			{practitioner && (
				<label className={styles.checkboxRow}>
					<Checkbox checked={isActive} onCheckedChange={setIsActive} />
					Active practitioner (kept for the records they signed when not)
				</label>
			)}
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || save.isPending}>
					{practitioner ? 'Save profile' : 'Add practitioner'}
				</Button>
			</DialogFooter>
		</form>
	);
}

function LinkForm({ entry, onDone }: { entry: ClinicPractitioner; onDone: () => void }) {
	const [roomName, setRoomName] = useState(entry.roomName ?? '');
	const [consultFee, setConsultFee] = useState(entry.consultFee == null ? '' : String(entry.consultFee));
	const [isActive, setIsActive] = useState(entry.isActive);
	const save = useMutation(clinicSetupApi.setPractitionerClinic.mutationOptions({ onSuccess: useRefresh(onDone) }));

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				save.mutate({
					practitionerId: entry.practitioner.id,
					roomName: orNull(roomName),
					consultFee: numberOrNull(consultFee),
					isActive,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>Room and fee: {entry.practitioner.displayName}</DialogTitle>
				<DialogDescription>At this clinic.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				<Field label='Room'>
					{(id) => (
						<Input
							id={id}
							value={roomName}
							placeholder='Room 2'
							onChange={(event) => setRoomName(event.target.value)}
						/>
					)}
				</Field>
				<Field label='Consultation fee (₱)' hint="Empty: the clinic's consultation price.">
					{(id, describedBy) => (
						<Input
							id={id}
							type='number'
							min={0}
							step='0.01'
							inputMode='decimal'
							aria-describedby={describedBy}
							value={consultFee}
							onChange={(event) => setConsultFee(event.target.value)}
						/>
					)}
				</Field>
			</div>
			<label className={styles.checkboxRow}>
				<Checkbox checked={isActive} onCheckedChange={setIsActive} />
				Holds clinic here now
			</label>
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={save.isPending}>
					Save
				</Button>
			</DialogFooter>
		</form>
	);
}

function ScheduleForm({ entry, onDone }: { entry: ClinicPractitioner; onDone: () => void }) {
	const [dayOfWeek, setDayOfWeek] = useState('1');
	const [startTime, setStartTime] = useState('09:00');
	const [endTime, setEndTime] = useState('12:00');
	const [slotMinutes, setSlotMinutes] = useState('15');
	const [maxPatients, setMaxPatients] = useState('');
	const save = useMutation(clinicSetupApi.saveSchedule.mutationOptions({ onSuccess: useRefresh(onDone) }));
	const slot = numberOrNull(slotMinutes);
	const valid = startTime < endTime && slot !== null && slot >= 5;

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) {
					save.mutate({
						practitionerId: entry.practitioner.id,
						dayOfWeek: Number(dayOfWeek),
						startTime,
						endTime,
						slotMinutes: slot,
						maxPatients: numberOrNull(maxPatients),
					});
				}
			}}
		>
			<DialogHeader>
				<DialogTitle>Add clinic hours: {entry.practitioner.displayName}</DialogTitle>
				<DialogDescription>A weekly session at this clinic, in Philippine time.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				<Field label='Day'>
					{(id) => (
						<Select value={dayOfWeek} onValueChange={setDayOfWeek}>
							<SelectTrigger id={id} aria-label='Day'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DAY_NAMES.map((name, index) => (
									<SelectItem key={name} value={String(index)}>
										{name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
				<Field label='From' required>
					{(id) => (
						<Input
							id={id}
							type='time'
							value={startTime}
							onChange={(event) => setStartTime(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Until' required error={startTime < endTime ? undefined : 'Ends after it starts.'}>
					{(id, describedBy) => (
						<Input
							id={id}
							type='time'
							aria-describedby={describedBy}
							aria-invalid={startTime < endTime ? undefined : true}
							value={endTime}
							onChange={(event) => setEndTime(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Slot (minutes)' required>
					{(id) => (
						<Input
							id={id}
							type='number'
							min={5}
							max={240}
							value={slotMinutes}
							onChange={(event) => setSlotMinutes(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Most patients' hint='Empty for no cap.'>
					{(id, describedBy) => (
						<Input
							id={id}
							type='number'
							min={1}
							aria-describedby={describedBy}
							value={maxPatients}
							onChange={(event) => setMaxPatients(event.target.value)}
						/>
					)}
				</Field>
			</div>
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || save.isPending}>
					Add hours
				</Button>
			</DialogFooter>
		</form>
	);
}

function LeaveForm({ entry, onDone }: { entry: ClinicPractitioner; onDone: () => void }) {
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [startTime, setStartTime] = useState('');
	const [endTime, setEndTime] = useState('');
	const [reason, setReason] = useState('');
	const save = useMutation(clinicSetupApi.addLeave.mutationOptions({ onSuccess: useRefresh(onDone) }));
	const lastDay = endDate || startDate;
	const valid = Boolean(startDate) && lastDay >= startDate;

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (valid) {
					save.mutate({
						practitionerId: entry.practitioner.id,
						startDate,
						endDate: lastDay,
						startTime: orNull(startTime),
						endTime: orNull(endTime),
						reason: orNull(reason),
					});
				}
			}}
		>
			<DialogHeader>
				<DialogTitle>Add a leave: {entry.practitioner.displayName}</DialogTitle>
				<DialogDescription>No bookings during it. Whole days unless you give times.</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				<Field label='From' required>
					{(id) => (
						<Input
							id={id}
							type='date'
							value={startDate}
							onChange={(event) => setStartDate(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Until' hint='Inclusive; empty for one day.'>
					{(id, describedBy) => (
						<Input
							id={id}
							type='date'
							min={startDate || undefined}
							aria-describedby={describedBy}
							value={endDate}
							onChange={(event) => setEndDate(event.target.value)}
						/>
					)}
				</Field>
				<Field label='From time' hint='Optional, on the first day.'>
					{(id, describedBy) => (
						<Input
							id={id}
							type='time'
							aria-describedby={describedBy}
							value={startTime}
							onChange={(event) => setStartTime(event.target.value)}
						/>
					)}
				</Field>
				<Field label='Until time' hint='Optional, on the last day.'>
					{(id, describedBy) => (
						<Input
							id={id}
							type='time'
							aria-describedby={describedBy}
							value={endTime}
							onChange={(event) => setEndTime(event.target.value)}
						/>
					)}
				</Field>
				<Field label='Reason' wide>
					{(id) => (
						<Input
							id={id}
							value={reason}
							placeholder='Conference, holiday, sick …'
							onChange={(event) => setReason(event.target.value)}
						/>
					)}
				</Field>
			</div>
			{save.error && <ErrorMessage message={save.error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || save.isPending}>
					Add leave
				</Button>
			</DialogFooter>
		</form>
	);
}
