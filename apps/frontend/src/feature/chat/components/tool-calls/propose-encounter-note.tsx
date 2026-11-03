import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EncounterNoteSchema } from '@loopwise/shared/encounter-record';
import { proposeEncounterNote } from '@loopwise/shared/tools';
import { FilePenLine } from 'lucide-react';
import { memo, useState } from 'react';
import { diffFields } from './proposal-card/diff-fields';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-encounter-note.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAgentContext } from '@/contexts/agent.provider';
import { encounterApi } from '@/lib/encounter-api';
import { encounterRecordApi } from '@/lib/encounter-record-api';

type NoteField = proposeEncounterNote.NoteField;
type NoteValues = Record<NoteField, string>;

const { NOTE_FIELDS, NOTE_FIELD_LABELS } = proposeEncounterNote;

const UPDATED_ANSWER = /^I updated the encounter note/;

/**
 * Wise's change to an encounter's SOAP note: a before → after card the clinician checks, edits and confirms
 * (DESIGN.md §9.1). Confirm saves through `updateEncounterNote` against the version Wise drafted from, so an edit made
 * meanwhile is never overwritten: the card says so and offers a new draft (`ProposalCard`).
 */
export const ProposeEncounterNoteToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_encounter_note'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.noteCardSkeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (!toolPart.input || !toolPart.output) {
		return null;
	}
	return <NoteCard toolCallId={toolPart.toolCallId} draft={toolPart.input} output={toolPart.output} />;
});

function NoteCard({
	toolCallId,
	draft,
	output,
}: {
	toolCallId: string;
	draft: proposeEncounterNote.Input;
	output: proposeEncounterNote.Output;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const before = toValues(output.current);
	const [proposed] = useState<NoteValues>(() => ({ ...before, ...pickNote(draft) }));
	const [values, setValues] = useState<NoteValues>(proposed);
	const [isEditing, setIsEditing] = useState(false);
	const [showAllFields, setShowAllFields] = useState(false);
	const update = useMutation(
		encounterRecordApi.encounterRecord.updateNote.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.get.pathFilter());
				void queryClient.invalidateQueries(encounterApi.encounter.list.pathFilter());
				void queueOrSendMessage({ text: 'I updated the encounter note.' });
			},
		}),
	);

	const changes = diffFields(before, values, NOTE_FIELD_LABELS);
	const parsed = EncounterNoteSchema.safeParse(values);
	const validationError = parsed.success ? undefined : parsed.error.issues[0]?.message;
	const draftedFields = new Set(changes.filter((change) => change.changed).map((change) => change.key));
	const visibleFields = NOTE_FIELDS.filter((field) => showAllFields || draftedFields.has(field));

	const confirm = ({ origin }: ProposalConfirm) => {
		if (!parsed.success) {
			setIsEditing(true);
			return;
		}
		return update.mutateAsync({
			encounterId: output.encounter.id,
			reason: values.reason.trim(),
			...Object.fromEntries(
				NOTE_FIELDS.filter((field) => field !== 'reason').map((field) => [field, values[field].trim() || null]),
			),
			expectedVersion: output.version,
			wiseOrigin: { ...origin, edited: NOTE_FIELDS.some((field) => values[field] !== proposed[field]) },
		});
	};

	return (
		<ProposalCard
			mode='update'
			target={{
				label: 'Encounter note',
				detail: [
					output.patientName,
					new Date(output.encounter.startedAt).toLocaleDateString(),
					output.encounter.facilityName,
				].join(' · '),
			}}
			changes={changes}
			toolCallId={toolCallId}
			toolName='propose_encounter_note'
			icon={FilePenLine}
			title='Update encounter note'
			testId='propose-encounter-note'
			confirmLabel='Save changes'
			onConfirm={confirm}
			isPending={update.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={update.error?.message ?? (isEditing ? undefined : validationError)}
			resolvedLabels={{ confirmed: 'Note updated', cancelled: 'Not changed' }}
			isConfirmedAnswer={(answer) => UPDATED_ANSWER.test(answer)}
		>
			<div className={styles.noteCardFields}>
				{visibleFields.map((field) => (
					<label key={field} className={styles.noteCardField}>
						<span>{NOTE_FIELD_LABELS[field]}</span>
						{field === 'reason' || field === 'followUpOn' ? (
							<Input
								type={field === 'followUpOn' ? 'date' : 'text'}
								value={values[field]}
								disabled={update.isPending}
								onChange={(event) => setValues({ ...values, [field]: event.target.value })}
							/>
						) : (
							<Textarea
								value={values[field]}
								rows={3}
								disabled={update.isPending}
								onChange={(event) => setValues({ ...values, [field]: event.target.value })}
							/>
						)}
					</label>
				))}
				{!showAllFields && (
					<button type='button' className={styles.noteCardMore} onClick={() => setShowAllFields(true)}>
						Edit other fields
					</button>
				)}
				{validationError && <p className={styles.noteCardError}>{validationError}</p>}
			</div>
		</ProposalCard>
	);
}

const toValues = (note: proposeEncounterNote.Note): NoteValues =>
	Object.fromEntries(NOTE_FIELDS.map((field) => [field, note[field] ?? ''])) as NoteValues;

/**
 * The fields the model proposed to change; the rest stay as they are. A blank field means "leave it" (models send
 * empty strings for fields they skip), never "clear it": clearing is the clinician's own edit.
 */
const pickNote = (draft: proposeEncounterNote.Input): Partial<NoteValues> =>
	Object.fromEntries(NOTE_FIELDS.filter((field) => draft[field]?.trim()).map((field) => [field, draft[field]]));
