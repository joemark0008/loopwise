import { useState } from 'react';
import { DISPOSITION_LABELS, DISPOSITIONS, EncounterNoteSchema, fieldErrors } from '@loopwise/shared/encounter-record';
import { SCRIBE_LANGUAGE_LABELS } from '@loopwise/shared/scribe';
import { CalendarCheck, FileText, MessageSquareText } from 'lucide-react';
import { followUpDate, SOAP_FIELDS, SOAP_LABELS, soapDraftValues } from './scribe-draft';
import { ScribePartCard } from './scribe-part-card';
import styles from './scribe.module.css';
import type { Disposition } from '@loopwise/shared/encounter-record';
import type { ScribePartProps } from './scribe-part-card';
import type { ProposalConfirm } from '@/feature/chat/components/tool-calls/proposal-card/proposal-card';
import type { NoteFormValues } from '@/feature/encounters/encounter-form-values';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { diffFields } from '@/feature/chat/components/tool-calls/proposal-card/diff-fields';
import { noteFormFrom, toUpdateNoteInput } from '@/feature/encounters/encounter-form-values';
import { FormField } from '@/feature/encounters/form-field';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/*
 * The parts of a scribe draft that write onto the encounter itself: the SOAP note, the follow-up and the patient
 * summary (the visit's patient instructions). Each is an update card: before → after against the note as it is now,
 * saved with `updateEncounterNote` at the version it showed, the rest of the note sent back unchanged.
 */

type NoteSlice<K extends keyof NoteFormValues> = { [P in K]: NoteFormValues[P] };

/** An update card on the encounter note: `fields` are what the card edits, merged into the note at Confirm. */
function NoteCard<K extends keyof NoteFormValues>({
	toolCallId,
	part,
	record,
	icon,
	title,
	confirmLabel,
	labels,
	drafted,
	renderFields,
	renderView,
	footer,
}: Omit<ScribePartProps, 'draft' | 'output'> & {
	icon: LucideIcon;
	title: string;
	confirmLabel: string;
	labels: Record<K, string>;
	drafted: NoteSlice<K>;
	renderFields: (
		values: NoteSlice<K>,
		set: (key: K, value: string) => void,
		errors: Record<string, string>,
	) => ReactNode;
	renderView?: (values: NoteSlice<K>) => ReactNode;
	footer?: ReactNode;
}) {
	const [initial] = useState(drafted);
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.updateNote);
	const current = noteFormFrom(record.encounter);
	const next = { ...current, ...values };
	const errors = fieldErrors(EncounterNoteSchema, next);
	const fieldError = Object.entries(errors).find(([field]) => field in labels)?.[1];
	const otherError = Object.entries(errors).find(([field]) => !(field in labels))?.[1];
	const set = (key: K, value: string) => setValues({ ...values, [key]: value } as NoteSlice<K>);

	const confirm = ({ origin }: ProposalConfirm) => {
		if (fieldError) {
			setIsEditing(true);
			return;
		}
		if (otherError) {
			return;
		}
		return save.mutateAsync({
			...toUpdateNoteInput(record.encounter, next),
			wiseOrigin: { ...origin, edited: JSON.stringify(values) !== JSON.stringify(initial) },
		});
	};

	return (
		<ScribePartCard
			mode='update'
			target={{ label: 'Encounter note', detail: record.encounter.encounterNo }}
			changes={diffFields(current, next, labels)}
			toolCallId={toolCallId}
			part={part}
			icon={icon}
			title={title}
			confirmLabel={confirmLabel}
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message ?? (otherError && `${otherError} Save the SOAP note first.`)}
			warnings={footer}
		>
			<div className={styles.cardBody}>
				{isEditing ? renderFields(values, set, errors) : renderView?.(values)}
				{fieldError && <p className={styles.error}>{fieldError}</p>}
			</div>
		</ScribePartCard>
	);
}

/** `soap`: the drafted sections over the note's current ones. */
export function SoapCard(props: ScribePartProps) {
	const current = noteFormFrom(props.record.encounter);
	const merged = soapDraftValues(current, props.draft.soap);
	const drafted = Object.fromEntries(SOAP_FIELDS.map((field) => [field, merged[field]])) as NoteSlice<
		(typeof SOAP_FIELDS)[number]
	>;
	return (
		<NoteCard
			{...props}
			icon={FileText}
			title='SOAP note'
			confirmLabel='Save note'
			labels={SOAP_LABELS}
			drafted={drafted}
			renderFields={(values, set, errors) => (
				<div className={styles.cardBody}>
					{SOAP_FIELDS.map((field) => (
						<FormField key={field} label={SOAP_LABELS[field]} error={errors[field]} wide>
							{(id) =>
								field === 'reason' ? (
									<Input
										id={id}
										value={values[field]}
										onChange={(event) => set(field, event.target.value)}
									/>
								) : (
									<Textarea
										id={id}
										rows={3}
										value={values[field]}
										onChange={(event) => set(field, event.target.value)}
									/>
								)
							}
						</FormField>
					))}
				</div>
			)}
		/>
	);
}

/** `follow_up`: the follow-up date (said, or counted from the visit) and the disposition. */
export function FollowUpCard(props: ScribePartProps) {
	const { draft, record } = props;
	const current = noteFormFrom(record.encounter);
	const drafted = {
		followUpOn: followUpDate(draft.followUp, record.encounter.startedAt) || current.followUpOn,
		disposition: (draft.followUp?.disposition ?? current.disposition) as Disposition | '',
	};
	return (
		<NoteCard
			{...props}
			icon={CalendarCheck}
			title='Follow-up'
			confirmLabel='Save follow-up'
			labels={{ followUpOn: 'Follow-up on', disposition: 'Disposition' }}
			drafted={drafted}
			footer={
				draft.followUp?.inDays && !draft.followUp.date ? (
					<p className={styles.note}>
						In {draft.followUp.inDays} days from the visit. Booking the appointment is the front desk&apos;s
						step.
					</p>
				) : undefined
			}
			renderFields={(values, set, errors) => (
				<div className={styles.fields}>
					<FormField label='Follow-up on' error={errors.followUpOn}>
						{(id) => (
							<Input
								id={id}
								type='date'
								value={values.followUpOn}
								onChange={(event) => set('followUpOn', event.target.value)}
							/>
						)}
					</FormField>
					<FormField label='Disposition' error={errors.disposition}>
						{(id) => (
							<select
								id={id}
								className={styles.select}
								value={values.disposition}
								onChange={(event) => set('disposition', event.target.value)}
							>
								<option value=''>Not yet</option>
								{DISPOSITIONS.map((option) => (
									<option key={option} value={option}>
										{DISPOSITION_LABELS[option]}
									</option>
								))}
							</select>
						)}
					</FormField>
				</div>
			)}
		/>
	);
}

/**
 * `summary`: a plain-language summary for the patient, saved as the visit's patient instructions. A draft for the
 * doctor: nothing sends it to the patient.
 */
export function SummaryCard(props: ScribePartProps) {
	const summary = props.draft.patientSummary;
	return (
		<NoteCard
			{...props}
			icon={MessageSquareText}
			title={`Patient summary · ${SCRIBE_LANGUAGE_LABELS[summary?.language ?? 'en']}`}
			confirmLabel='Save to patient instructions'
			labels={{ patientInstructions: 'Patient instructions' }}
			drafted={{ patientInstructions: summary?.text.trim() ?? '' }}
			footer={
				<p className={styles.note}>
					A draft for you: it is saved to the visit&apos;s instructions and never sent to the patient by
					itself. Read it with the patient or print it.
				</p>
			}
			renderFields={(values, set, errors) => (
				<FormField label='Patient instructions' error={errors.patientInstructions} wide>
					{(id) => (
						<Textarea
							id={id}
							rows={6}
							value={values.patientInstructions}
							onChange={(event) => set('patientInstructions', event.target.value)}
						/>
					)}
				</FormField>
			)}
		/>
	);
}
