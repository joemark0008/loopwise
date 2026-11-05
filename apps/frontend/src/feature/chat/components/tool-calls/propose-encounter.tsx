import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stethoscope } from 'lucide-react';
import { computeBmi, VITAL_FIELDS, VitalsDraftSchema } from '@loopwise/shared/vitals';
import { memo, useState } from 'react';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-encounter.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { proposeEncounter } from '@loopwise/shared/tools';
import type { EncounterFormValues } from '@/feature/patients/encounter-form-values';
import type { ToolCallComponentProps } from '.';
import type { WiseOriginInput } from '@/graphql/generated/graphql';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { EncounterFields } from '@/feature/patients/encounter-fields';
import {
	defaultEncounterClinicId,
	draftStartToLocalInput,
	emptyEncounterForm,
	toCreateEncounterInput,
	validateEncounterForm,
} from '@/feature/patients/encounter-form-values';
import { vitalChips } from '@/feature/encounters/encounter-format';
import { getActiveClinicId } from '@/lib/active-clinic';
import { encounterApi } from '@/lib/encounter-api';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const RECORDED_ANSWER = /^I recorded the encounter/;

/** Wise's draft of a visit, from the chart chat: the clinician checks it and confirms (DESIGN.md §7.1). */
export const ProposeEncounterToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_encounter'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.encounterCardSkeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	if (!toolPart.input || !toolPart.output) {
		return null;
	}
	return <EncounterCard toolCallId={toolPart.toolCallId} draft={toolPart.input} output={toolPart.output} />;
});

function EncounterCard({
	toolCallId,
	draft,
	output,
}: {
	toolCallId: string;
	draft: proposeEncounter.Input;
	output: proposeEncounter.Output;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage, chatId } = useAgentContext();
	const [initial] = useState<EncounterFormValues>(() => fromDraft(draft, output.clinics));
	const [values, setValues] = useState<EncounterFormValues>(initial);
	const [isEditing, setIsEditing] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	const vitals = parseVitals(draft.vitals);
	const diagnoses = (draft.diagnoses ?? []).filter(
		(diagnosis) => diagnosis.icd10Code.trim() && diagnosis.description.trim(),
	);
	const create = useMutation(encounterApi.encounter.create.mutationOptions());
	const errors = validateEncounterForm(values);
	const clinic = output.clinics.find((candidate) => candidate.id === values.clinicId)?.name;

	const confirm = ({ origin }: ProposalConfirm) => {
		setShowErrors(true);
		if (Object.keys(errors).length > 0) {
			setIsEditing(true);
			return;
		}
		const wiseOrigin = { ...origin, edited: JSON.stringify(values) !== JSON.stringify(initial) };
		return create
			.mutateAsync({ ...toCreateEncounterInput(output.patientId, values, chatId), wiseOrigin })
			.then(async (encounter) => {
				// The drafted vitals and diagnoses complete the confirmed card; the audit rows say so.
				const failures = await recordDraftedRecord(encounter.id, vitals, diagnoses, wiseOrigin);
				void queryClient.invalidateQueries(encounterApi.encounter.list.pathFilter());
				void queueOrSendMessage({
					text:
						`I recorded the encounter: ${encounter.reason ?? 'visit'}.` +
						(failures.length > 0 ? ` These were not saved: ${failures.join('; ')}.` : ''),
				});
			});
	};

	return (
		<ProposalCard
			toolCallId={toolCallId}
			toolName='propose_encounter'
			icon={Stethoscope}
			title='Record encounter'
			testId='propose-encounter'
			confirmLabel='Save encounter'
			onConfirm={confirm}
			isPending={create.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={create.error?.message}
			resolvedLabels={{ confirmed: 'Recorded', cancelled: 'Not recorded' }}
			isConfirmedAnswer={(answer) => RECORDED_ANSWER.test(answer)}
		>
			{isEditing ? (
				<EncounterFields
					values={values}
					errors={showErrors ? errors : {}}
					clinics={output.clinics}
					onChange={setValues}
					disabled={create.isPending}
				/>
			) : (
				<div className={styles.encounterCardSummary}>
					<p className={styles.encounterCardReason}>{values.reason || 'No reason given'}</p>
					{values.notes && <p className={styles.encounterCardNotes}>{values.notes}</p>}
					{vitals.chips.length > 0 && (
						<p className={styles.encounterCardNotes} data-testid='drafted-vitals'>
							{vitals.chips.join(' · ')}
						</p>
					)}
					{vitals.error && <p className={styles.encounterCardError}>Vitals left out: {vitals.error}</p>}
					{diagnoses.length > 0 && (
						<p className={styles.encounterCardNotes} data-testid='drafted-diagnoses'>
							{diagnoses.map((diagnosis) => `${diagnosis.icd10Code} ${diagnosis.description}`).join('; ')}
						</p>
					)}
					<p className={styles.encounterCardMeta}>
						{values.startedAt && new Date(values.startedAt).toLocaleString()}
						{clinic && ` · ${clinic}`}
					</p>
					{showErrors && Object.values(errors)[0] && (
						<p className={styles.encounterCardError}>{Object.values(errors)[0]}</p>
					)}
				</div>
			)}
		</ProposalCard>
	);
}

function fromDraft(draft: proposeEncounter.Input, clinics: proposeEncounter.Output['clinics']): EncounterFormValues {
	return {
		...emptyEncounterForm(defaultEncounterClinicId(clinics, getActiveClinicId())),
		type: draft.type ?? 'CONSULTATION',
		reason: draft.reason ?? '',
		notes: draft.notes ?? '',
		startedAt: draftStartToLocalInput(draft.startedAt),
	};
}

type DraftedVitals = { input: Record<string, number> | null; chips: string[]; error: string | null };

/** The vitals Wise drafted, checked with the shared rules: invalid ones are shown and left out, not saved. */
function parseVitals(vitals: proposeEncounter.Input['vitals']): DraftedVitals {
	// Models fill unstated numbers with 0 or null: those are not measurements (a stated pain score of 0 is lost too).
	const stated = Object.fromEntries(
		Object.entries(vitals ?? {}).filter(([, value]) => typeof value === 'number' && value !== 0),
	);
	if (Object.keys(stated).length === 0) {
		return { input: null, chips: [], error: null };
	}
	const parsed = VitalsDraftSchema.safeParse(stated);
	if (!parsed.success) {
		return { input: null, chips: [], error: parsed.error.issues[0]?.message ?? 'not valid' };
	}
	const row = Object.fromEntries(VITAL_FIELDS.map((field) => [field, parsed.data[field] ?? null]));
	const bmi = computeBmi(parsed.data.weightKg, parsed.data.heightCm) ?? null;
	return {
		input: Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)),
		chips: vitalChips({ ...row, bmi } as Parameters<typeof vitalChips>[0]),
		error: null,
	};
}

/** After the encounter is saved: its vitals and diagnoses (first = primary, not final). Returns what failed. */
async function recordDraftedRecord(
	encounterId: string,
	vitals: DraftedVitals,
	diagnoses: NonNullable<proposeEncounter.Input['diagnoses']>,
	wiseOrigin: WiseOriginInput,
): Promise<string[]> {
	const failures: string[] = [];
	const record = encounterRecordApi.encounterRecord;
	if (vitals.input) {
		await record.recordVitals.mutate({ encounterId, ...vitals.input, wiseOrigin }).catch((error: Error) => {
			failures.push(`vitals (${error.message})`);
		});
	}
	for (const [index, diagnosis] of diagnoses.entries()) {
		await record.addDiagnosis
			.mutate({
				encounterId,
				icd10Code: diagnosis.icd10Code,
				description: diagnosis.description,
				type: index === 0 ? 'PRIMARY' : 'SECONDARY',
				isFinal: false,
				wiseOrigin,
			})
			.catch((error: Error) => {
				failures.push(`${diagnosis.icd10Code} (${error.message})`);
			});
	}
	return failures;
}
