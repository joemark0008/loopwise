import { useState } from 'react';
import { DISPOSITION_LABELS, DISPOSITIONS, EncounterNoteSchema, fieldErrors } from '@loopwise/shared/encounter-record';
import { DiagnosesSection } from './diagnoses-section';
import styles from './encounter.module.css';
import { noteFormFrom, toUpdateNoteInput } from './encounter-form-values';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import type { Disposition } from '@loopwise/shared/encounter-record';
import type { NoteFormValues } from './encounter-form-values';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/** No disposition chosen yet (a Select item can't have an empty value). */
const NO_DISPOSITION = 'none';

const SOAP: { key: Exclude<keyof NoteFormValues, 'disposition'>; label: string; placeholder: string }[] = [
	{ key: 'history', label: 'History (S)', placeholder: 'History of present illness, relevant past history' },
	{ key: 'reviewOfSystems', label: 'Review of systems', placeholder: 'Pertinent positives and negatives by system' },
	{ key: 'subjective', label: 'Other subjective', placeholder: 'Past, family and social history, medicines taken' },
	{ key: 'physicalExam', label: 'Examination (O)', placeholder: 'Physical examination findings' },
	{ key: 'objective', label: 'Other objective', placeholder: 'Point-of-care tests, results reviewed' },
	{ key: 'assessment', label: 'Assessment (A)', placeholder: 'Clinical impression' },
	{ key: 'plan', label: 'Plan (P)', placeholder: 'Medicines, tests, referrals, advice' },
	{ key: 'patientInstructions', label: 'Instructions to the patient', placeholder: 'In plain words' },
];

/** The SOAP note, plan, follow-up and disposition of the visit, and its ICD-10 diagnoses. */
export function NoteTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [values, setValues] = useState<NoteFormValues>(() => noteFormFrom(record.encounter));
	const [showErrors, setShowErrors] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.updateNote);
	const errors = fieldErrors(EncounterNoteSchema, values);
	const isDirty = JSON.stringify(values) !== JSON.stringify(noteFormFrom(record.encounter));
	const disabled = !record.canEdit || save.isPending;
	const set = <K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) =>
		setValues({ ...values, [key]: value });

	return (
		<>
			<form
				className={styles.section}
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					setShowErrors(true);
					if (Object.keys(errors).length === 0) {
						save.mutate(toUpdateNoteInput(record.encounter, values));
					}
				}}
			>
				<div className={styles.fields}>
					<FormField label='Chief complaint' error={showErrors ? errors.reason : undefined} wide>
						{(id) => (
							<Input
								id={id}
								value={values.reason}
								onChange={(event) => set('reason', event.target.value)}
								disabled={disabled}
							/>
						)}
					</FormField>
					{SOAP.map(({ key, label, placeholder }) => (
						<FormField key={key} label={label} error={showErrors ? errors[key] : undefined} wide>
							{(id) => (
								<Textarea
									id={id}
									rows={3}
									value={values[key]}
									placeholder={placeholder}
									onChange={(event) => set(key, event.target.value)}
									disabled={disabled}
								/>
							)}
						</FormField>
					))}
					<FormField label='Follow-up on' error={showErrors ? errors.followUpOn : undefined}>
						{(id) => (
							<Input
								id={id}
								type='date'
								value={values.followUpOn}
								onChange={(event) => set('followUpOn', event.target.value)}
								disabled={disabled}
							/>
						)}
					</FormField>
					<FormField label='Disposition' error={showErrors ? errors.disposition : undefined}>
						{() => (
							<Select
								value={values.disposition || NO_DISPOSITION}
								onValueChange={(value) =>
									set('disposition', value === NO_DISPOSITION ? '' : (value as Disposition))
								}
								disabled={disabled}
							>
								<SelectTrigger className={styles.control} aria-label='Disposition'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_DISPOSITION}>Not yet</SelectItem>
									{DISPOSITIONS.map((option) => (
										<SelectItem key={option} value={option}>
											{DISPOSITION_LABELS[option]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</FormField>
				</div>
				{save.error && <ErrorMessage message={save.error.message} />}
				{record.canEdit && (
					<div className={styles.actions}>
						<Button type='submit' size='sm' disabled={disabled || !isDirty}>
							Save note
						</Button>
						{save.isSuccess && !isDirty && <span className={styles.muted}>Saved.</span>}
					</div>
				)}
			</form>
			<DiagnosesSection record={record} />
		</>
	);
}
