import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ALLERGY_KINDS, ALLERGY_SEVERITIES, AllergyDraftSchema, fieldErrors } from '@loopwise/shared/encounter-record';
import { VITAL_FIELDS, VITAL_RANGES } from '@loopwise/shared/vitals';
import { wiseAction } from '@loopwise/shared/wise-actions';
import { ClipboardCheck, FlaskConical, HeartPulse, ShieldAlert, ShieldX, TestTubes } from 'lucide-react';
import { memo, useState } from 'react';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { listResultsToReview } from '@loopwise/shared/tools';
import type {
	ActionOutput,
	ProposeAllergyInput,
	ProposeOrderInput,
	ProposeRemoveAllergyInput,
	ProposeResultReviewInput,
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { emptyVitalsForm, toRecordVitalsInput, validateVitalsForm } from '@/feature/encounters/encounter-form-values';
import { formatDay } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { patientApi } from '@/lib/patient-api';
import { resultApi } from '@/lib/result-api';
import { wiseActionsApi } from '@/lib/wise-actions-api';
import { resultValue, testName, URGENCY_LABELS } from '@/feature/results/result-format';

/*
 * The cards of the Wise action tools (DESIGN.md §9.4, `@loopwise/shared/wise-actions`). Each is the shared proposal card
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

type AllergyForm = { substance: string; kind: string; reaction: string; severity: string };

/** `propose_allergy`: an allergy for the patient's record, saved with `addAllergy` at the clinician's facility. */
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
	const facilities = useQuery(patientApi.patient.facilities.queryOptions());
	const [initial] = useState<AllergyForm>(() => ({
		substance: input.substance ?? '',
		kind: input.kind ?? 'drug',
		reaction: input.reaction ?? '',
		severity: input.severity ?? '',
	}));
	const [values, setValues] = useState(initial);
	const [facilityId, setFacilityId] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.addAllergy);
	const errors = fieldErrors(AllergyDraftSchema, values);
	const facility = facilityId || (facilities.data?.length === 1 ? facilities.data[0].id : '');

	const confirm = ({ origin }: ProposalConfirm) => {
		if (Object.keys(errors).length > 0 || !facility) {
			setIsEditing(true);
			return;
		}
		const parsed = AllergyDraftSchema.parse(values) as z.output<typeof AllergyDraftSchema>;
		return save
			.mutateAsync({
				patientId: output.patientId ?? '',
				facilityId: facility,
				substance: parsed.substance,
				kind: parsed.kind,
				reaction: parsed.reaction ?? null,
				severity: parsed.severity ?? null,
				wiseOrigin: { ...origin, edited: isEdited(values, initial) },
			})
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.allergies.pathFilter());
				void queueOrSendMessage({ text: `I added the allergy: ${parsed.substance}.` });
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
							{option}
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
			error={save.error?.message ?? facilities.error?.message}
			isConfirmDisabled={!facilities.data}
		>
			{isEditing ? (
				<div className={styles.grid}>
					<FormField label='Substance' error={errors.substance}>
						{(id) => (
							<Input
								id={id}
								value={values.substance}
								disabled={save.isPending}
								onChange={(event) => setValues({ ...values, substance: event.target.value })}
							/>
						)}
					</FormField>
					{select('kind', ALLERGY_KINDS, 'Kind')}
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
					{(facilities.data?.length ?? 0) > 1 && (
						<FormField label='Recorded at'>
							{(id) => (
								<select
									id={id}
									className={styles.select}
									value={facilityId}
									onChange={(event) => setFacilityId(event.target.value)}
								>
									<option value=''>Pick a facility</option>
									{facilities.data?.map((candidate) => (
										<option key={candidate.id} value={candidate.id}>
											{candidate.name}
										</option>
									))}
								</select>
							)}
						</FormField>
					)}
				</div>
			) : (
				<p className={styles.summary} data-testid='drafted-allergy'>
					<strong>{values.substance || 'No substance'}</strong> ({values.kind})
					{values.reaction && ` · ${values.reaction}`}
					{values.severity && ` · ${values.severity}`}
				</p>
			)}
		</ActionCard>
	);
}

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
	const wanted = input.substance.trim().toLowerCase();
	const allergy = allergies.data.find((candidate) => candidate.substance.trim().toLowerCase() === wanted);
	if (!allergy) {
		return <ErrorMessage message={`This patient has no recorded allergy to ${input.substance}.`} />;
	}

	const confirm = ({ origin, reason }: ProposalConfirm) =>
		save
			.mutateAsync({ id: allergy.id, reason: reason ?? '', wiseOrigin: { ...origin, edited: false } })
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.allergies.pathFilter());
				void queueOrSendMessage({ text: `I removed the allergy: ${allergy.substance}.` });
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
				label: `${allergy.substance} (${allergy.kind})`,
				detail: [allergy.reaction, allergy.severity, 'stays in the record, struck through']
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

/** `propose_result_review`: marks one result reviewed with the clinician's note; a critical one needs it, twice. */
export const ProposeResultReviewToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_result_review'>) => (
	<ActionFrame<ProposeResultReviewInput> toolPart={toolPart}>
		{(input, output) => <ResultReviewCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function ResultReviewCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeResultReviewInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const results = useQuery(resultApi.result.forPatient.queryOptions({ patientId: output.patientId ?? '' }));
	const evaluation = useQuery(wiseActionsApi.resultEvaluation.queryOptions({ resultId: output.subjectId ?? '' }));
	const [note, setNote] = useState(input.note ?? '');
	const review = useRecordMutation(resultApi.result.review);
	if (results.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (results.error) {
		return <ErrorMessage message={results.error.message} />;
	}
	const result = results.data.find((candidate) => candidate.id === output.subjectId);
	if (!result) {
		return <ErrorMessage message="Wise named a result that isn't this patient's, or that you can't see." />;
	}
	if (result.reviewedAt) {
		return <p className={styles.meta}>{testName(result)} is already reviewed.</p>;
	}
	const isCritical = result.urgency === 'critical';
	const needsNote = isCritical && !note.trim();

	const confirm = ({ origin }: ProposalConfirm) =>
		review
			.mutateAsync({
				resultId: result.id,
				note: note.trim() || null,
				wiseOrigin: { ...origin, edited: note !== (input.note ?? '') },
			})
			.then(() => {
				void queryClient.invalidateQueries(resultApi.result.toReview.pathFilter());
				void queryClient.invalidateQueries(resultApi.result.forPatient.pathFilter());
				void queueOrSendMessage({ text: `I reviewed the result: ${testName(result)}.` });
			});

	return (
		<ActionCard
			toolPart={toolPart}
			icon={ClipboardCheck}
			title='Review result'
			confirmLabel={isCritical ? 'Mark critical result reviewed' : 'Mark reviewed'}
			resolved='Reviewed'
			answer='I reviewed the result'
			confirmStrength={isCritical ? 'strong' : 'standard'}
			onConfirm={confirm}
			isPending={review.isPending}
			isConfirmDisabled={needsNote}
			error={review.error?.message}
			warnings={
				isCritical && (
					<p className={styles.critical} role='alert'>
						Critical value: act now. Note what you did (called the patient, referred); you confirm twice.
					</p>
				)
			}
		>
			<p className={styles.summary} data-testid='review-result'>
				<strong>{testName(result)}</strong> {resultValue(result)}
				{result.refRange && ` (ref ${result.refRange})`} · {URGENCY_LABELS[result.urgency]} ·{' '}
				{result.sourceFacility.name}
			</p>
			{evaluation.data && (
				<p className={styles.meta}>
					{evaluation.data.pathwayName}: {evaluation.data.classification} · {evaluation.data.reason}
					{evaluation.data.slaHours !== null && ` · act within ${evaluation.data.slaHours} h`}
				</p>
			)}
			<FormField label={isCritical ? 'Note (required)' : 'Note'}>
				{(id) => (
					<Textarea
						id={id}
						rows={2}
						value={note}
						disabled={review.isPending}
						onChange={(event) => setNote(event.target.value)}
					/>
				)}
			</FormField>
		</ActionCard>
	);
}

/** `propose_order`: lab or imaging tests for a visit, to the lab the clinician picks, all saved in one transaction. */
export const ProposeOrderToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_order'>) => (
	<ActionFrame<ProposeOrderInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <OrderCard toolPart={toolPart} input={input} output={output} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function OrderCard({
	toolPart,
	input,
	output,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeOrderInput;
	output: ActionOutput;
	record: EncounterRecordFieldsFragment;
}) {
	const { queueOrSendMessage } = useAgentContext();
	const options = useQuery(encounterRecordApi.encounterRecord.orderOptions.queryOptions());
	const tests = output.tests ?? [];
	const named = input.targetFacility?.trim().toLowerCase();
	const suggested = named
		? options.data?.orderTargets.find((target) => target.name.toLowerCase().includes(named))?.id
		: undefined;
	const [targetId, setTargetId] = useState<string | null>(null);
	const [priority, setPriority] = useState(input.priority ?? 'routine');
	const [notes, setNotes] = useState(input.notes ?? '');
	const target =
		targetId ?? suggested ?? (options.data?.orderTargets.length === 1 ? options.data.orderTargets[0].id : '');
	const save = useRecordMutation(encounterRecordApi.encounterRecord.createOrders);
	const targetName = options.data?.orderTargets.find((candidate) => candidate.id === target)?.name;

	const confirm = ({ origin }: ProposalConfirm) => {
		if (!target) {
			return;
		}
		return save
			.mutateAsync({
				encounterId: record.encounter.id,
				codes: tests.map((test) => test.code),
				targetOrgId: target,
				priority,
				notes: notes.trim() || null,
				wiseOrigin: {
					...origin,
					edited:
						targetId !== null ||
						priority !== (input.priority ?? 'routine') ||
						notes !== (input.notes ?? ''),
				},
			})
			.then(
				() =>
					void queueOrSendMessage({
						text: `I ordered ${tests.map((test) => test.display).join(', ')} at ${targetName}.`,
					}),
			);
	};

	return (
		<ActionCard
			toolPart={toolPart}
			icon={TestTubes}
			title='Order tests'
			confirmLabel={tests.length > 1 ? `Order ${tests.length} tests` : 'Order test'}
			resolved='Ordered'
			answer='I ordered'
			onConfirm={confirm}
			isPending={save.isPending}
			isConfirmDisabled={!target}
			error={save.error?.message ?? options.error?.message}
		>
			<VisitLink record={record} tab='orders' />
			<ul className={styles.list} data-testid='drafted-tests'>
				{tests.map((test) => (
					<li key={test.code}>
						{test.display} <span className={styles.meta}>LOINC {test.code}</span>
					</li>
				))}
			</ul>
			<div className={styles.grid}>
				<FormField label='Send to'>
					{(id) => (
						<select
							id={id}
							className={styles.select}
							value={target}
							disabled={save.isPending || !options.data}
							onChange={(event) => setTargetId(event.target.value)}
						>
							<option value=''>Pick a lab</option>
							{options.data?.orderTargets.map((candidate) => (
								<option key={candidate.id} value={candidate.id}>
									{candidate.name}
								</option>
							))}
						</select>
					)}
				</FormField>
				<FormField label='Priority'>
					{(id) => (
						<select
							id={id}
							className={styles.select}
							value={priority}
							disabled={save.isPending}
							onChange={(event) => setPriority(event.target.value as typeof priority)}
						>
							<option value='routine'>Routine</option>
							<option value='urgent'>Urgent</option>
							<option value='stat'>STAT</option>
						</select>
					)}
				</FormField>
				<FormField label='Notes for the lab' wide>
					{(id) => (
						<Input
							id={id}
							value={notes}
							disabled={save.isPending}
							onChange={(event) => setNotes(event.target.value)}
						/>
					)}
				</FormField>
			</div>
		</ActionCard>
	);
}

/** `list_results_to_review`: what Wise read from the inbox, critical first, each with the rules engine's reading. */
export const ListResultsToReviewToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_results_to_review'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listResultsToReview.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='results-to-review'>
			<p className={styles.resultsTitle}>
				<FlaskConical aria-hidden /> Results to review ({output.results.length}
				{output.truncated && '+'})
				<Link to='/results' className={styles.link}>
					Open the inbox
				</Link>
			</p>
			{output.results.length === 0 ? (
				<p className={styles.meta}>Nothing waiting for your review.</p>
			) : (
				<ul className={styles.list}>
					{output.results.map((result) => (
						<li key={result.id} data-urgency={result.urgency}>
							<strong>{result.test}</strong> {result.value}
							{result.unit && ` ${result.unit}`}
							{result.refRange && ` (ref ${result.refRange})`} · {URGENCY_LABELS[result.urgency]} ·{' '}
							{result.patient.name}
							{result.evaluation && <span className={styles.meta}> · {result.evaluation.reason}</span>}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
