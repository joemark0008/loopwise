import { useId } from 'react';
import styles from './patient-fields.module.css';
import type { ReactNode } from 'react';
import type { EncounterFormErrors, EncounterFormValues } from './encounter-form-values';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** The encounter fields of the New encounter dialog and the Wise card. Controlled: the parent owns the values. */
export function EncounterFields({
	values,
	errors,
	facilities,
	onChange,
	disabled,
}: {
	values: EncounterFormValues;
	errors: EncounterFormErrors;
	facilities: { id: string; name: string }[];
	onChange: (values: EncounterFormValues) => void;
	disabled?: boolean;
}) {
	const set = <K extends keyof EncounterFormValues>(key: K, value: EncounterFormValues[K]) =>
		onChange({ ...values, [key]: value });

	return (
		<div className={styles.patientFields}>
			<Field label='Reason for visit' error={errors.reason} wide>
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
			{facilities.length > 1 && (
				<Field label='Facility' error={errors.facilityId}>
					{() => (
						<Select value={values.facilityId} onValueChange={(value) => set('facilityId', value)}>
							<SelectTrigger className={styles.patientFieldControl} aria-label='Facility'>
								<SelectValue placeholder='Choose the facility' />
							</SelectTrigger>
							<SelectContent>
								{facilities.map((facility) => (
									<SelectItem key={facility.id} value={facility.id}>
										{facility.name}
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
