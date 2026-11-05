import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ALLERGY_TYPES, ALLERGY_SEVERITIES, AllergyDraftSchema, fieldErrors } from '@loopwise/shared/encounter-record';
import { VITAL_FIELDS, VITAL_RANGES } from '@loopwise/shared/vitals';
import { wiseAction } from '@loopwise/shared/wise-actions';
import { HeartPulse, ShieldAlert, ShieldX } from 'lucide-react';
import { memo, useState } from 'react';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type {
	ActionOutput,
	ProposeAllergyInput,
	ProposeRemoveAllergyInput,
	ProposeVitalsInput,
} from '@loopwise/shared/wise-actions';
import type { z } from 'zod/v3';
import type { ToolCallComponentProps } from '.';
import type { VitalsFormValues } from '@/feature/encounters/encounter-form-values';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { emptyVitalsForm, toRecordVitalsInput, validateVitalsForm } from '@/feature/encounters/encounter-form-values';
import { formatDay } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/*
 * The cards of the Wise action tools (DESIGN.md §7.3, `@loopwise/shared/wise-actions`). Each is the shared proposal card
 * in the mode and confirm strength its definition gives, around a small body: the draft, editable, and the record it
 * is about, loaded as the clinician. Confirm calls the action's mutation with the card's `wiseOrigin`, and the API
 * accepts it only from that tool, once.
 */

export type ToolPart = { state: string; toolCallId: string; input?: unknown; output?: unknown; errorText?: string };

export const isEdited = <T,>(values: T, initial: T) => JSON.stringify(values) !== JSON.stringify(initial);

/** The tool part's states before the card: streaming, failed, or nothing to show. */
export function ActionFrame<TInput>({
	toolPart,
	children,
}: {
	toolPart: ToolPart;
	children: (input: TInput, output: ActionOutput) => ReactNode;
}) {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText ?? 'The draft failed.'} />;
	}
	if (!toolPart.input || !toolPart.output) {
		return null;
	}
	return children(toolPart.input as TInput, toolPart.output as ActionOutput);
}

/** The encounter an action is about, read as the clinician: it must be this chat's patient's, and theirs to add to. */
function useEncounter(output: ActionOutput) {
	return useQuery({
		...encounterRecordApi.encounterRecord.get.queryOptions({ encounterId: output.subjectId ?? '' }),
		enabled: Boolean(output.subjectId),
	});
}

export function EncounterGate({
	output,
	children,
}: {
	output: ActionOutput;
	children: (record: EncounterRecordFieldsFragment) => ReactNode;
}) {
	const record = useEncounter(output);
	if (record.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (record.error) {
		return <ErrorMessage message={record.error.message} />;
	}
	if (!record.data || record.data.encounter.patientId !== output.patientId) {
		return <ErrorMessage message="Wise named a visit that isn't this patient's, or that you can't see." />;
	}
	if (!record.data.canEdit) {
		return <ErrorMessage message='Only staff at the facility of the visit can add to its record.' />;
	}
	return children(record.data);
}

export const visitLine = (record: EncounterRecordFieldsFragment) =>
	`${record.encounter.reason ?? 'Visit'} · ${formatDay(record.encounter.startedAt.slice(0, 10))}`;

export function VisitLink({ record, tab }: { record: EncounterRecordFieldsFragment; tab: string }) {
	return (
		<p className={styles.meta}>
			{visitLine(record)} ·{' '}
			<Link
				to='/patients/$patientId/encounters/$encounterId'
				params={{ patientId: record.encounter.patientId, encounterId: record.encounter.id }}
				search={{ tab: tab as never }}
				className={styles.link}
			>
				Open the visit
			</Link>
		</p>
	);
}

/** The shared card of a Wise action: its definition sets the mode, and a strong confirm asks for a second click. */
export function ActionCard({
	toolPart,
	icon,
	title,
	confirmLabel,
	resolved,
	answer,
	target,
	mode,
	...props
}: {
	toolPart: ToolPart;
	icon: LucideIcon;
	title: string;
	confirmLabel: string;
	/** The settled line when confirmed. */
	resolved: string;
	/** The start of the message Confirm sends, so a reopened chat shows the card settled. */
	answer: string;
	target?: { label: string; detail?: string };
	children: ReactNode;
	onConfirm: (confirm: ProposalConfirm) => Promise<unknown> | void;
	error?: string;
	warnings?: ReactNode;
	isPending?: boolean;
	isEditing?: boolean;
	onEditToggle?: () => void;
	isConfirmDisabled?: boolean;
	/** Overrides the definition's mode, for a multi-step action (rejecting, voiding). */
	mode?: 'create' | 'destructive';
	/** Overrides the definition's, e.g. a strong confirm for a critical result. */
	confirmStrength?: 'standard' | 'reason' | 'strong';
}) {
	const toolName = (toolPart as { type?: string }).type?.replace(/^tool-/, '') ?? '';
	const action = wiseAction(toolName);
	const shared = {
		...props,
		toolCallId: toolPart.toolCallId,
		toolName,
		icon,
		title,
		confirmLabel,
		testId: toolName.replaceAll('_', '-'),
		confirmStrength: props.confirmStrength ?? action?.confirm,
		resolvedLabels: { confirmed: resolved, cancelled: 'Not saved' },
		isConfirmedAnswer: (text: string) => text.startsWith(answer),
	};
	// A destructive card names what it removes; the others show the record in their body.
	return (mode ?? action?.mode) === 'destructive' ? (
		<ProposalCard {...shared} mode='destructive' target={target ?? { label: title }} />
	) : (
		<ProposalCard {...shared} />
	);
}

/** Models fill unstated numbers with 0 or null: those are not measurements (a stated pain score of 0 is lost too). */
function vitalsForm(vitals: ProposeVitalsInput['vitals'] | undefined): VitalsFormValues {
	const form = emptyVitalsForm();
	for (const field of VITAL_FIELDS) {
		const value = vitals?.[field];
		if (typeof value === 'number' && value !== 0) {
			form[field] = String(value);
		}
	}
	return form;
}

const vitalsSummary = (values: VitalsFormValues) => {
	const parts: string[] = [];
	if (values.systolicMmHg && values.diastolicMmHg) {
		parts.push(`BP ${values.systolicMmHg}/${values.diastolicMmHg} mmHg`);
	}
	for (const field of VITAL_FIELDS) {
		if (field !== 'systolicMmHg' && field !== 'diastolicMmHg' && values[field]) {
			parts.push(`${VITAL_RANGES[field].label} ${values[field]} ${VITAL_RANGES[field].unit}`);
		}
	}
	return parts.join(' · ');
};

/** `propose_vitals`: vital signs for a visit that exists, saved with `recordVitals`. */
export const ProposeVitalsToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_vitals'>) => (
	<ActionFrame<ProposeVitalsInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <VitalsCard toolPart={toolPart} input={input} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function VitalsCard({
	toolPart,
	input,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeVitalsInput;
	record: EncounterRecordFieldsFragment;
}) {
	const { queueOrSendMessage } = useAgentContext();
	const [initial] = useState(() => vitalsForm(input.vitals));
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.recordVitals);
	const errors = validateVitalsForm(values);
	const firstError = Object.values(errors)[0];

	const confirm = ({ origin }: ProposalConfirm) => {
		if (firstError) {
			setIsEditing(true);
			return;
		}
		return save
			.mutateAsync({
				...toRecordVitalsInput(record.encounter.id, values),
				wiseOrigin: { ...origin, edited: isEdited(values, initial) },
			})
			.then(() => void queueOrSendMessage({ text: `I recorded the vitals: ${vitalsSummary(values)}.` }));
	};

	return (
		<ActionCard
			toolPart={toolPart}
			icon={HeartPulse}
			title='Record vitals'
			confirmLabel='Save vitals'
			resolved='Vitals recorded'
			answer='I recorded the vitals'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
		>
			<VisitLink record={record} tab='vitals' />
			{isEditing ? (
				<div className={styles.grid}>
					{VITAL_FIELDS.map((field) => (
						<FormField
							key={field}
							label={VITAL_RANGES[field].label}
							unit={VITAL_RANGES[field].unit}
							error={errors[field]}
						>
							{(id) => (
								<Input
									id={id}
									inputMode='decimal'
									value={values[field]}
									disabled={save.isPending}
									onChange={(event) => setValues({ ...values, [field]: event.target.value })}
								/>
							)}
						</FormField>
					))}
				</div>
			) : (
				<p className={styles.summary} data-testid='drafted-vitals'>
					{vitalsSummary(values) || 'No measurements'}
				</p>
			)}
			{!isEditing && firstError && <p className={styles.error}>{firstError}</p>}
		</ActionCard>
	);
}

type AllergyForm = { allergen: string; type: string; reaction: string; severity: string };

/** `propose_allergy`: an allergy for the patient's record, saved with `addAllergy`. */
export const ProposeAllergyToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_allergy'>) => (
	<ActionFrame<ProposeAllergyInput> toolPart={toolPart}>
		{(input, output) => <AllergyCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function AllergyCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeAllergyInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [initial] = useState<AllergyForm>(() => ({
		allergen: input.allergen ?? '',
		type: input.type ?? 'DRUG',
		reaction: input.reaction ?? '',
		severity: input.severity ?? '',
	}));
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.addAllergy);
	const errors = fieldErrors(AllergyDraftSchema, values);

	const confirm = ({ origin }: ProposalConfirm) => {
		if (Object.keys(errors).length > 0) {
			setIsEditing(true);
			return;
		}
		const parsed = AllergyDraftSchema.parse(values) as z.output<typeof AllergyDraftSchema>;
		return save
			.mutateAsync({
				patientId: output.patientId ?? '',
				allergen: parsed.allergen,
				type: parsed.type,
				reaction: parsed.reaction ?? null,
				severity: parsed.severity ?? null,
				wiseOrigin: { ...origin, edited: isEdited(values, initial) },
			})
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.allergies.pathFilter());
				void queueOrSendMessage({ text: `I added the allergy: ${parsed.allergen}.` });
			});
	};

	const select = (key: keyof AllergyForm, options: readonly string[], label: string, optional = false) => (
		<FormField label={label} error={errors[key]}>
			{(id) => (
				<select
					id={id}
					className={styles.select}
					value={values[key]}
					disabled={save.isPending}
					onChange={(event) => setValues({ ...values, [key]: event.target.value })}
				>
					{optional && <option value=''>Not stated</option>}
					{options.map((option) => (
						<option key={option} value={option}>
							{enumLabel(option)}
						</option>
					))}
				</select>
			)}
		</FormField>
	);

	return (
		<ActionCard
			toolPart={toolPart}
			icon={ShieldAlert}
			title='Add allergy'
			confirmLabel='Add allergy'
			resolved='Allergy added'
			answer='I added the allergy'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
		>
			{isEditing ? (
				<div className={styles.grid}>
					<FormField label='Allergen' error={errors.allergen}>
						{(id) => (
							<Input
								id={id}
								value={values.allergen}
								disabled={save.isPending}
								onChange={(event) => setValues({ ...values, allergen: event.target.value })}
							/>
						)}
					</FormField>
					{select('type', ALLERGY_TYPES, 'Type')}
					<FormField label='Reaction' error={errors.reaction}>
						{(id) => (
							<Input
								id={id}
								value={values.reaction}
								disabled={save.isPending}
								onChange={(event) => setValues({ ...values, reaction: event.target.value })}
							/>
						)}
					</FormField>
					{select('severity', ALLERGY_SEVERITIES, 'Severity', true)}
				</div>
			) : (
				<p className={styles.summary} data-testid='drafted-allergy'>
					<strong>{values.allergen || 'No allergen'}</strong> ({enumLabel(values.type)})
					{values.reaction && ` · ${values.reaction}`}
					{values.severity && ` · ${enumLabel(values.severity)}`}
				</p>
			)}
		</ActionCard>
	);
}

/** `DRUG` → `drug`, `TRANSFERRED_ER` → `transferred er`: an enum value as words. */
const enumLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ');

/** `propose_remove_allergy`: voids one recorded allergy (it stays, struck through) with the clinician's reason. */
export const ProposeRemoveAllergyToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_remove_allergy'>) => (
	<ActionFrame<ProposeRemoveAllergyInput> toolPart={toolPart}>
		{(input, output) => <RemoveAllergyCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function RemoveAllergyCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeRemoveAllergyInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const allergies = useQuery(
		encounterRecordApi.encounterRecord.allergies.queryOptions({ patientId: output.patientId ?? '' }),
	);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.voidAllergy);
	if (allergies.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (allergies.error) {
		return <ErrorMessage message={allergies.error.message} />;
	}
	const wanted = input.allergen.trim().toLowerCase();
	const allergy = allergies.data.find((candidate) => candidate.allergen.trim().toLowerCase() === wanted);
	if (!allergy) {
		return <ErrorMessage message={`This patient has no recorded allergy to ${input.allergen}.`} />;
	}

	const confirm = ({ origin, reason }: ProposalConfirm) =>
		save
			.mutateAsync({ id: allergy.id, reason: reason ?? '', wiseOrigin: { ...origin, edited: false } })
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.allergies.pathFilter());
				void queueOrSendMessage({ text: `I removed the allergy: ${allergy.allergen}.` });
			});

	return (
		<ActionCard
			toolPart={toolPart}
			icon={ShieldX}
			title='Remove allergy'
			confirmLabel='Remove allergy'
			resolved='Allergy removed'
			answer='I removed the allergy'
			target={{
				label: `${allergy.allergen} (${enumLabel(allergy.type)})`,
				detail: [
					allergy.reaction,
					allergy.severity && enumLabel(allergy.severity),
					'stays in the record, struck through',
				]
					.filter(Boolean)
					.join(' · '),
			}}
			onConfirm={confirm}
			isPending={save.isPending}
			error={save.error?.message}
		>
			{input.reason && <p className={styles.meta}>Wise noted: {input.reason}</p>}
		</ActionCard>
	);
}
