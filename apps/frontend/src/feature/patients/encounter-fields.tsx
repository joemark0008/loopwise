import { ENCOUNTER_TYPE_LABELS, ENCOUNTER_TYPES } from '@loopwise/shared/encounter';
import { useId } from 'react';
import styles from './patient-fields.module.css';
import type { EncounterType } from '@loopwise/shared/encounter';
import type { ReactNode } from 'react';
import type { EncounterFormErrors, EncounterFormValues, InitialEncounterStatus } from './encounter-form-values';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** The encounter fields of the New encounter dialog and the Wise card. Controlled: the parent owns the values. */
export function EncounterFields({
	values,
	errors,
	clinics,
	onChange,
	disabled,
}: {
	values: EncounterFormValues;
	errors: EncounterFormErrors;
	clinics: { id: string; name: string }[];
	onChange: (values: EncounterFormValues) => void;
	disabled?: boolean;
}) {
	const set = <K extends keyof EncounterFormValues>(key: K, value: EncounterFormValues[K]) =>
		onChange({ ...values, [key]: value });

	return (
		<div className={styles.patientFields}>
			<Field label='Chief complaint' error={errors.reason} wide>
				{(id) => (
					<Input
						id={id}
						value={values.reason}
						placeholder='Fatigue for 2 weeks, BP check'
						onChange={(event) => set('reason', event.target.value)}
						disabled={disabled}
						aria-invalid={errors.reason ? true : undefined}
					/>
				)}
			</Field>
			<Field label='Notes' error={errors.notes} wide>
				{(id) => (
					<Textarea
						id={id}
						value={values.notes}
						rows={5}
						placeholder='Complaint, vitals, findings, assessment, plan'
						onChange={(event) => set('notes', event.target.value)}
						disabled={disabled}
					/>
				)}
			</Field>
			<Field label='Started' error={errors.startedAt}>
				{(id) => (
					<Input
						id={id}
						type='datetime-local'
						value={values.startedAt}
						onChange={(event) => set('startedAt', event.target.value)}
						disabled={disabled}
					/>
				)}
			</Field>
			<Field label='Kind of visit' error={errors.type}>
				{() => (
					<Select
						value={values.type}
						onValueChange={(value) => set('type', value as EncounterType)}
						disabled={disabled}
					>
						<SelectTrigger className={styles.patientFieldControl} aria-label='Kind of visit'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ENCOUNTER_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{ENCOUNTER_TYPE_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</Field>
			<Field label='Status' error={errors.status}>
				{() => (
					<Select
						value={values.status || 'DEFAULT'}
						onValueChange={(value) =>
							set('status', value === 'DEFAULT' ? '' : (value as InitialEncounterStatus))
						}
						disabled={disabled}
					>
						<SelectTrigger className={styles.patientFieldControl} aria-label='Status'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='DEFAULT'>Automatic</SelectItem>
							<SelectItem value='OPEN'>Waiting (checked in)</SelectItem>
							<SelectItem value='IN_PROGRESS'>With the doctor</SelectItem>
						</SelectContent>
					</Select>
				)}
			</Field>
			{clinics.length > 1 && (
				<Field label='Clinic' error={errors.clinicId}>
					{() => (
						<Select value={values.clinicId} onValueChange={(value) => set('clinicId', value)}>
							<SelectTrigger className={styles.patientFieldControl} aria-label='Clinic'>
								<SelectValue placeholder='Choose the clinic' />
							</SelectTrigger>
							<SelectContent>
								{clinics.map((clinic) => (
									<SelectItem key={clinic.id} value={clinic.id}>
										{clinic.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Field>
			)}
		</div>
	);
}

function Field({
	label,
	error,
	wide,
	children,
}: {
	label: string;
	error?: string;
	wide?: boolean;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<div className={styles.patientField} data-wide={wide || undefined}>
			<label htmlFor={id} className={styles.patientFieldLabel}>
				{label}
			</label>
			{children(id)}
			{error && <p className={styles.patientFieldError}>{error}</p>}
		</div>
	);
}
