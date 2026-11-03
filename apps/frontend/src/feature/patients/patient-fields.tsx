import { PATIENT_LANGUAGES, PATIENT_SEXES } from '@loopwise/shared/patient-registration';
import { useId } from 'react';
import styles from './patient-fields.module.css';
import type { PatientLanguage, PatientSex } from '@loopwise/shared/patient-registration';
import type { ReactNode } from 'react';
import type { PatientFormErrors, PatientFormValues } from './patient-form-values';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SEX_LABELS: Record<PatientSex, string> = { female: 'Female', male: 'Male', other: 'Other', unknown: 'Unknown' };

/** The patient fields of the register page and the Wise proposal card. Controlled: the parent owns the values. */
export function PatientFields({
	values,
	errors,
	facilities,
	onChange,
	disabled,
}: {
	values: PatientFormValues;
	/** Shown only once the parent wants them (after a submit attempt). */
	errors: PatientFormErrors;
	facilities: { id: string; name: string }[];
	onChange: (values: PatientFormValues) => void;
	disabled?: boolean;
}) {
	const set = <K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) =>
		onChange({ ...values, [key]: value });
	const text = (
		key: keyof PatientFormValues,
		label: string,
		props: { placeholder?: string; type?: string; autoComplete?: string; required?: boolean } = {},
	) => {
		const { required, ...inputProps } = props;
		return (
			<Field label={label} error={errors[key]} required={required}>
				{(id, describedBy) => (
					<Input
						id={id}
						value={values[key]}
						onChange={(event) => set(key, event.target.value as never)}
						disabled={disabled}
						aria-invalid={errors[key] ? true : undefined}
						aria-required={required || undefined}
						aria-describedby={describedBy}
						{...inputProps}
					/>
				)}
			</Field>
		);
	};

	return (
		<div className={styles.patientFieldGroups}>
			<fieldset className={styles.patientFieldset}>
				<legend className={styles.patientLegend}>Patient</legend>
				<div className={styles.patientFields}>
					{facilities.length > 1 && (
						<Field label='Facility' error={errors.facilityId} wide required>
							{(id, describedBy) => (
								<Select value={values.facilityId} onValueChange={(value) => set('facilityId', value)}>
									<SelectTrigger
										id={id}
										className={styles.patientFieldControl}
										aria-label='Facility'
										aria-describedby={describedBy}
									>
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
					{text('givenName', 'Given name', { placeholder: 'Maria', autoComplete: 'off', required: true })}
					{text('familyName', 'Family name', { placeholder: 'Santos', autoComplete: 'off', required: true })}
					{text('birthDate', 'Birth date', { type: 'date', required: true })}
					<Field label='Sex' error={errors.sex} required>
						{(id, describedBy) => (
							<Select
								value={values.sex}
								onValueChange={(value) => set('sex', value as PatientSex)}
								disabled={disabled}
							>
								<SelectTrigger
									id={id}
									className={styles.patientFieldControl}
									aria-label='Sex'
									aria-invalid={errors.sex ? true : undefined}
									aria-describedby={describedBy}
								>
									<SelectValue placeholder='Choose' />
								</SelectTrigger>
								<SelectContent>
									{PATIENT_SEXES.map((sex) => (
										<SelectItem key={sex} value={sex}>
											{SEX_LABELS[sex]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</Field>
				</div>
			</fieldset>
			<fieldset className={styles.patientFieldset}>
				<legend className={styles.patientLegend}>Identifiers and contact</legend>
				<div className={styles.patientFields}>
					{text('mrn', 'MRN', { placeholder: 'THC-0042' })}
					{text('philHealthId', 'PhilHealth number', { placeholder: '12-345678901-2' })}
					{text('phone', 'Mobile number', { placeholder: '0917 123 4567', type: 'tel' })}
					<Field label='Preferred language' error={errors.preferredLanguage} required>
						{(id, describedBy) => (
							<Select
								value={values.preferredLanguage}
								onValueChange={(value) => set('preferredLanguage', value as PatientLanguage)}
								disabled={disabled}
							>
								<SelectTrigger
									id={id}
									className={styles.patientFieldControl}
									aria-label='Preferred language'
									aria-describedby={describedBy}
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PATIENT_LANGUAGES.map((language) => (
										<SelectItem key={language.value} value={language.value}>
											{language.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</Field>
				</div>
			</fieldset>
		</div>
	);
}

/** A labelled field; its error sits under it and is linked to the control (`aria-describedby`). */
function Field({
	label,
	error,
	wide,
	required,
	children,
}: {
	label: string;
	error?: string;
	wide?: boolean;
	required?: boolean;
	children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
	const id = useId();
	const errorId = `${id}-error`;
	return (
		<div className={styles.patientField} data-wide={wide || undefined}>
			<label htmlFor={id} className={styles.patientFieldLabel} data-required={required || undefined}>
				{label}
			</label>
			{children(id, error ? errorId : undefined)}
			{error && (
				<p id={errorId} className={styles.patientFieldError}>
					{error}
				</p>
			)}
		</div>
	);
}
