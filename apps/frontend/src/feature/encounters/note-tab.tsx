import { useState } from 'react';
import { fieldErrors, EncounterNoteSchema } from '@loopwise/shared/encounter-record';
import { DiagnosesSection } from './diagnoses-section';
import styles from './encounter.module.css';
import { noteFormFrom, toUpdateNoteInput } from './encounter-form-values';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import type { NoteFormValues } from './encounter-form-values';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const SOAP: { key: keyof NoteFormValues; label: string; placeholder: string }[] = [
	{ key: 'history', label: 'History (S)', placeholder: 'History of present illness, relevant past history' },
	{ key: 'physicalExam', label: 'Examination (O)', placeholder: 'Physical examination findings' },
	{ key: 'assessment', label: 'Assessment (A)', placeholder: 'Clinical impression' },
	{ key: 'plan', label: 'Plan (P)', placeholder: 'Medicines, tests, referrals, advice' },
	{ key: 'patientInstructions', label: 'Instructions to the patient', placeholder: 'In plain words' },
];

/** The SOAP note, plan and follow-up of the visit, and its ICD-10 diagnoses. */
export function NoteTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [values, setValues] = useState<NoteFormValues>(() => noteFormFrom(record.encounter));
	const [showErrors, setShowErrors] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.updateNote);
	const errors = fieldErrors(EncounterNoteSchema, values);
	const isDirty = JSON.stringify(values) !== JSON.stringify(noteFormFrom(record.encounter));
	const disabled = !record.canEdit || save.isPending;
	const set = (key: keyof NoteFormValues, value: string) => setValues({ ...values, [key]: value });

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
