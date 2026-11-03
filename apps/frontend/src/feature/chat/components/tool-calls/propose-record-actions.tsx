import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DIAGNOSIS_CERTAINTIES } from '@quarry/shared/encounter-record';
import { formatPesos } from '@quarry/shared/encounter-bill';
import { resolveLabTest } from '@quarry/shared/wise-actions';
import {
	BookmarkPlus,
	ClipboardList,
	FileCheck2,
	Phone,
	ReceiptText,
	Stethoscope,
	TestTubes,
	XCircle,
} from 'lucide-react';
import { memo, useState } from 'react';
import { ActionCard, ActionFrame, EncounterGate, isEdited, VisitLink } from './propose-action';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { ToolPart } from './propose-action';
import type { listLabOrders, report } from '@quarry/shared/tools';
import type {
	ActionOutput,
	ProposeBillStepInput,
	ProposeCancelOrderInput,
	ProposeDiagnosisInput,
	ProposeIssueDocumentInput,
	ProposeLabOrderStepInput,
	ProposePatientUpdateInput,
	ProposeSaveReportInput,
	ProposeVoidDiagnosisInput,
	ProposeVoidDocumentInput,
	ProposeVoidVitalsInput,
} from '@quarry/shared/wise-actions';
import type { ToolCallComponentProps } from '.';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext, useAgentMessagesSelector } from '@/contexts/agent.provider';
import { formatDateTime, medicineName } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { ordersApi } from '@/lib/orders-api';
import { wiseActionsApi } from '@/lib/wise-actions-api';

/*
 * The cards of the phase-2 Wise actions (DESIGN.md §9.4): changes to a visit's record, an order's steps, documents,
 * bills, reports and contact details. Same rules as `propose-action.tsx`: the card loads the record as the clinician,
 * and only Confirm calls the mutation, with the card's `wiseOrigin`.
 */

const origin = (confirm: ProposalConfirm, edited = false) => ({ ...confirm.origin, edited });

const sameCode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/** The record's item the card is about, or a message saying it isn't there. */
function Missing({ message }: { message: string }) {
	return <ErrorMessage message={message} />;
}

/** `propose_diagnosis`: a new diagnosis, or a change to the one the visit has with that code. */
export const ProposeDiagnosisToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_diagnosis'>) => (
	<ActionFrame<ProposeDiagnosisInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <DiagnosisCard toolPart={toolPart} input={input} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function DiagnosisCard({
	toolPart,
	input,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeDiagnosisInput;
	record: EncounterRecordFieldsFragment;
}) {
	const { queueOrSendMessage } = useAgentContext();
	const existing = record.diagnoses.find((row) => !row.voidedAt && sameCode(row.icd10Code, input.icd10Code));
	const [initial] = useState(() => ({
		icd10Code: input.icd10Code,
		display: input.display,
		certainty: input.certainty ?? existing?.certainty ?? 'provisional',
		isPrimary: input.isPrimary ?? existing?.isPrimary ?? false,
		notes: input.notes ?? existing?.notes ?? '',
	}));
	const [values, setValues] = useState(initial);
	const add = useRecordMutation(encounterRecordApi.encounterRecord.addDiagnosis);
	const update = useRecordMutation(encounterRecordApi.encounterRecord.updateDiagnosis);
	const pending = add.isPending || update.isPending;

	const confirm = (confirmed: ProposalConfirm) => {
		const wiseOrigin = origin(confirmed, isEdited(values, initial));
		const saved = existing
			? update.mutateAsync({
					id: existing.id,
					certainty: values.certainty,
					isPrimary: values.isPrimary,
					notes: values.notes.trim() || null,
					wiseOrigin,
				})
			: add.mutateAsync({
					encounterId: record.encounter.id,
					icd10Code: values.icd10Code,
					display: values.display,
					certainty: values.certainty,
					isPrimary: values.isPrimary,
					notes: values.notes.trim() || null,
					wiseOrigin,
				});
		return saved.then(
			() =>
				void queueOrSendMessage({
					text: `I ${existing ? 'updated' : 'added'} the diagnosis: ${values.icd10Code} ${values.display}.`,
				}),
		);
	};

	return (
		<ActionCard
			toolPart={toolPart}
			icon={Stethoscope}
			title={existing ? 'Change diagnosis' : 'Add diagnosis'}
			confirmLabel={existing ? 'Save changes' : 'Add diagnosis'}
			resolved={existing ? 'Diagnosis updated' : 'Diagnosis added'}
			answer={existing ? 'I updated the diagnosis' : 'I added the diagnosis'}
			onConfirm={confirm}
			isPending={pending}
			error={add.error?.message ?? update.error?.message}
		>
			<VisitLink record={record} tab='diagnoses' />
			<p className={styles.summary} data-testid='drafted-diagnosis'>
				<strong>{values.icd10Code}</strong> {values.display}
			</p>
			{existing && (
				<p className={styles.meta}>
					On the visit: {existing.certainty}
					{existing.isPrimary && ', primary'}
					{existing.notes && ` · ${existing.notes}`}
				</p>
			)}
			<div className={styles.grid}>
				<FormField label='Certainty'>
					{(id) => (
						<select
							id={id}
							className={styles.select}
							value={values.certainty}
							disabled={pending}
							onChange={(event) =>
								setValues({ ...values, certainty: event.target.value as typeof values.certainty })
							}
						>
							{DIAGNOSIS_CERTAINTIES.map((certainty) => (
								<option key={certainty} value={certainty}>
									{certainty}
								</option>
							))}
						</select>
					)}
				</FormField>
				<FormField label='Primary'>
					{(id) => (
						<input
							id={id}
							type='checkbox'
							checked={values.isPrimary}
							disabled={pending}
							onChange={(event) => setValues({ ...values, isPrimary: event.target.checked })}
						/>
					)}
				</FormField>
				<FormField label='Notes' wide>
					{(id) => (
						<Input
							id={id}
							value={values.notes}
							disabled={pending}
							onChange={(event) => setValues({ ...values, notes: event.target.value })}
						/>
					)}
				</FormField>
			</div>
		</ActionCard>
	);
}

/** `propose_void_diagnosis`: voids the visit's diagnosis with that code. */
export const ProposeVoidDiagnosisToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_void_diagnosis'>) => (
	<ActionFrame<ProposeVoidDiagnosisInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => {
					const diagnosis = record.diagnoses.find(
						(row) => !row.voidedAt && sameCode(row.icd10Code, input.icd10Code),
					);
					return diagnosis ? (
						<VoidCard
							toolPart={toolPart}
							title='Remove diagnosis'
							label={`${diagnosis.icd10Code} ${diagnosis.display}`}
							detail='stays in the record, struck through'
							note={input.reason}
							run={(confirmed, reason) =>
								encounterRecordApi.encounterRecord.voidDiagnosis.mutate({
									id: diagnosis.id,
									reason,
									wiseOrigin: origin(confirmed),
								})
							}
							answer={`I removed the diagnosis: ${diagnosis.icd10Code}.`}
						/>
					) : (
						<Missing message={`This visit has no diagnosis ${input.icd10Code}.`} />
					);
				}}
			</EncounterGate>
		)}
	</ActionFrame>
));

/** `propose_void_vitals`: voids one set of the visit's vitals (the latest unless the clinician picks another). */
export const ProposeVoidVitalsToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_void_vitals'>) => (
	<ActionFrame<ProposeVoidVitalsInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <VoidVitalsCard toolPart={toolPart} input={input} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function VoidVitalsCard({
	toolPart,
	input,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeVoidVitalsInput;
	record: EncounterRecordFieldsFragment;
}) {
	const sets = record.vitals.filter((row) => !row.voidedAt).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
	const [vitalsId, setVitalsId] = useState(sets[0]?.id ?? '');
	if (sets.length === 0) {
		return <Missing message='This visit has no vital signs to remove.' />;
	}
	const describe = (row: (typeof sets)[number]) =>
		[
			formatDateTime(row.recordedAt),
			row.systolicMmHg !== null && `BP ${row.systolicMmHg}/${row.diastolicMmHg}`,
			row.heartRateBpm !== null && `HR ${row.heartRateBpm}`,
			row.temperatureC !== null && `${row.temperatureC} °C`,
			row.weightKg !== null && `${row.weightKg} kg`,
		]
			.filter(Boolean)
			.join(' · ');
	const chosen = sets.find((row) => row.id === vitalsId) ?? sets[0];
	return (
		<VoidCard
			toolPart={toolPart}
			title='Remove vitals'
			label={describe(chosen)}
			detail='stays in the record, struck through'
			note={input.reason}
			run={(confirmed, reason) =>
				encounterRecordApi.encounterRecord.voidVitals.mutate({
					id: chosen.id,
					reason,
					wiseOrigin: origin(confirmed, chosen.id !== sets[0].id),
				})
			}
			answer={`I removed the vitals of ${formatDateTime(chosen.recordedAt)}.`}
		>
			{sets.length > 1 && (
				<FormField label='Which set'>
					{(id) => (
						<select
							id={id}
							className={styles.select}
							value={chosen.id}
							onChange={(event) => setVitalsId(event.target.value)}
						>
							{sets.map((row) => (
								<option key={row.id} value={row.id}>
									{describe(row)}
								</option>
							))}
						</select>
					)}
				</FormField>
			)}
		</VoidCard>
	);
}

/** `propose_cancel_order`: the ordering doctor withdraws a test of the visit before collection. */
export const ProposeCancelOrderToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_cancel_order'>) => (
	<ActionFrame<ProposeCancelOrderInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => {
					const code = resolveLabTest(input.test)?.code;
					const order = record.orders.find(
						(row) =>
							(row.code === code || row.display?.toLowerCase() === input.test.trim().toLowerCase()) &&
							(row.status === 'sent' || row.status === 'accepted'),
					);
					return order ? (
						<VoidCard
							toolPart={toolPart}
							title='Cancel order'
							confirmLabel='Cancel order'
							label={`${order.display ?? order.code} · ${order.status}`}
							detail={`to ${order.targetFacility?.name ?? 'the lab'}; the lab sees your reason`}
							note={input.reason}
							run={(confirmed, reason) =>
								ordersApi.order.cancel.mutate({
									orderId: order.id,
									reason,
									wiseOrigin: origin(confirmed),
								})
							}
							answer={`I cancelled the order: ${order.display ?? order.code}.`}
						/>
					) : (
						<Missing message={`This visit has no ${input.test} order that can still be cancelled.`} />
					);
				}}
			</EncounterGate>
		)}
	</ActionFrame>
));

/** A destructive card: names the record, takes the reason, confirms twice, then runs `run`. */
function VoidCard({
	toolPart,
	title,
	confirmLabel = title,
	label,
	detail,
	note,
	run,
	answer,
	children,
}: {
	toolPart: ToolPart;
	title: string;
	confirmLabel?: string;
	label: string;
	detail?: string;
	note?: string;
	run: (confirm: ProposalConfirm, reason: string) => Promise<unknown>;
	/** The message Confirm sends; the card is settled by its first words. */
	answer: string;
	children?: React.ReactNode;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const confirm = (confirmed: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		return run(confirmed, confirmed.reason ?? '')
			.then(() => {
				void queryClient.invalidateQueries();
				void queueOrSendMessage({ text: answer });
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={XCircle}
			title={title}
			confirmLabel={confirmLabel}
			resolved='Done'
			answer={answer.split(':')[0]}
			mode='destructive'
			target={{ label, detail }}
			onConfirm={confirm}
			isPending={pending}
			error={error}
		>
			{note && <p className={styles.meta}>Wise noted: {note}</p>}
			{children}
		</ActionCard>
	);
}

const STEP_LABELS = { accept: 'Accept order', collect: 'Mark collected', reject: 'Reject order' } as const;

/** `propose_lab_order_step`: the receiving facility accepts, collects or rejects one order on its worklist. */
export const ProposeLabOrderStepToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_lab_order_step'>) => (
	<ActionFrame<ProposeLabOrderStepInput> toolPart={toolPart}>
		{(input, output) => <LabStepCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function LabStepCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeLabOrderStepInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const sent = useQuery(ordersApi.order.labOrders.queryOptions({ status: 'sent' }));
	const accepted = useQuery(ordersApi.order.labOrders.queryOptions({ status: 'accepted' }));
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	if (sent.isPending || accepted.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	const order = [...(sent.data ?? []), ...(accepted.data ?? [])].find((row) => row.id === output.subjectId);
	if (!order) {
		return <Missing message="That order isn't on your worklist, or it has moved on already." />;
	}
	const label = `${order.display ?? order.code} · ${order.priority.toUpperCase()} · ${order.patient.givenName} ${order.patient.familyName}`;
	const confirm = (confirmed: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		const wiseOrigin = origin(confirmed);
		const step =
			input.step === 'accept'
				? wiseActionsApi.acceptOrder.mutate({ orderId: order.id, wiseOrigin })
				: input.step === 'collect'
					? wiseActionsApi.markOrderCollected.mutate({ orderId: order.id, wiseOrigin })
					: ordersApi.order.reject.mutate({ orderId: order.id, reason: confirmed.reason ?? '', wiseOrigin });
		return step
			.then(() => {
				void queryClient.invalidateQueries(ordersApi.order.labOrders.pathFilter());
				void queueOrSendMessage({
					text: `I did it: ${STEP_LABELS[input.step]} for ${order.display ?? order.code}.`,
				});
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={TestTubes}
			title={STEP_LABELS[input.step]}
			confirmLabel={STEP_LABELS[input.step]}
			resolved='Done'
			answer='I did it'
			mode={input.step === 'reject' ? 'destructive' : 'create'}
			target={{ label, detail: `from ${order.orderingDoctorName}, ${order.orderingFacilityName}` }}
			onConfirm={confirm}
			isPending={pending}
			error={error}
		>
			{input.step !== 'reject' && (
				<p className={styles.summary} data-testid='lab-order'>
					{label}
				</p>
			)}
			{input.reason && <p className={styles.meta}>Wise noted: {input.reason}</p>}
		</ActionCard>
	);
}

/** `list_lab_orders`: the worklist Wise read, STAT first. */
export const ListLabOrdersToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_lab_orders'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listLabOrders.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='lab-orders'>
			<p className={styles.resultsTitle}>
				<ClipboardList aria-hidden /> Worklist ({output.orders.length}
				{output.truncated && '+'})
				<Link to='/orders' className={styles.link}>
					Open the worklist
				</Link>
			</p>
			{output.orders.length === 0 ? (
				<p className={styles.meta}>No orders waiting.</p>
			) : (
				<ul className={styles.list}>
					{output.orders.map((order) => (
						<li key={order.id}>
							<strong>{order.test}</strong> · {order.priority.toUpperCase()} · {order.status} ·{' '}
							{order.patient.name} · {order.orderingDoctor}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

const DOCUMENT_LABELS = { prescription: 'prescription', medical_certificate: 'medical certificate' } as const;

/** The visit's prescription or certificate a document card is about: the newest one not voided. */
function currentDocument(record: EncounterRecordFieldsFragment, kind: ProposeIssueDocumentInput['document']) {
	const rows = kind === 'prescription' ? record.prescriptions : record.medicalCertificates;
	return [...rows].filter((row) => row.status !== 'voided').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/** `propose_issue_document`: signs the visit's draft prescription or certificate; a strong confirm. */
export const ProposeIssueDocumentToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_issue_document'>) => (
	<ActionFrame<ProposeIssueDocumentInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <IssueDocumentCard toolPart={toolPart} input={input} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function IssueDocumentCard({
	toolPart,
	input,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeIssueDocumentInput;
	record: EncounterRecordFieldsFragment;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const label = DOCUMENT_LABELS[input.document];
	const document = currentDocument(record, input.document);
	if (!document || document.status !== 'draft') {
		return <Missing message={`This visit has no draft ${label} to issue.`} />;
	}
	const prescription =
		input.document === 'prescription' ? record.prescriptions.find((row) => row.id === document.id) : null;
	const confirm = (confirmed: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		const issue =
			input.document === 'prescription'
				? wiseActionsApi.issuePrescription.mutate({ id: document.id, wiseOrigin: origin(confirmed) })
				: wiseActionsApi.issueCertificate.mutate({ id: document.id, wiseOrigin: origin(confirmed) });
		return issue
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.get.pathFilter());
				void queueOrSendMessage({ text: `I issued the ${label}.` });
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={FileCheck2}
			title={`Issue ${label}`}
			confirmLabel={`Issue ${label}`}
			resolved='Issued'
			answer={`I issued the ${label}`}
			onConfirm={confirm}
			isPending={pending}
			error={error}
			warnings={
				<p className={styles.meta}>
					Signed with your name and PRC license; it can only be voided after. You confirm twice.
				</p>
			}
		>
			<VisitLink record={record} tab={input.document === 'prescription' ? 'prescriptions' : 'certificate'} />
			{prescription && (
				<ul className={styles.list} data-testid='issue-items'>
					{prescription.items.map((item) => (
						<li key={item.id}>{medicineName(item)}</li>
					))}
				</ul>
			)}
		</ActionCard>
	);
}

/** `propose_void_document`: voids the visit's prescription or certificate. */
export const ProposeVoidDocumentToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_void_document'>) => (
	<ActionFrame<ProposeVoidDocumentInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => {
					const label = DOCUMENT_LABELS[input.document];
					const document = currentDocument(record, input.document);
					return document ? (
						<VoidCard
							toolPart={toolPart}
							title={`Void ${label}`}
							label={`${label} · ${document.status}`}
							detail='stays in the record, marked void'
							note={input.reason}
							run={(confirmed, reason) =>
								input.document === 'prescription'
									? encounterRecordApi.encounterRecord.voidPrescription.mutate({
											id: document.id,
											reason,
											wiseOrigin: origin(confirmed),
										})
									: encounterRecordApi.encounterRecord.voidCertificate.mutate({
											id: document.id,
											reason,
											wiseOrigin: origin(confirmed),
										})
							}
							answer={`I voided the ${label}.`}
						/>
					) : (
						<Missing message={`This visit has no ${label} to void.`} />
					);
				}}
			</EncounterGate>
		)}
	</ActionFrame>
));

/** `propose_bill_step`: finalize (strong), pay (OR number) or void (reason) the visit's bill. */
export const ProposeBillStepToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_bill_step'>) => (
	<ActionFrame<ProposeBillStepInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <BillStepCard toolPart={toolPart} input={input} record={record} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function BillStepCard({
	toolPart,
	input,
	record,
}: {
	toolPart: ToolPart;
	input: ProposeBillStepInput;
	record: EncounterRecordFieldsFragment;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [orNumber, setOrNumber] = useState(input.orNumber ?? '');
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const bill = record.bills.find((row) => row.status !== 'voided');
	if (!bill) {
		return <Missing message='This visit has no bill. Draft the charges first.' />;
	}
	const label = `Bill ${formatPesos(bill.total)} · ${bill.status}`;
	if (input.step === 'void') {
		return (
			<VoidCard
				toolPart={toolPart}
				title='Void bill'
				label={label}
				detail='stays in the record, marked void'
				note={input.reason}
				run={(confirmed, reason) =>
					encounterRecordApi.encounterRecord.voidBill.mutate({
						id: bill.id,
						reason,
						wiseOrigin: origin(confirmed),
					})
				}
				answer='I voided the bill.'
			/>
		);
	}
	const finalize = input.step === 'finalize';
	const confirm = (confirmed: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		const step = finalize
			? wiseActionsApi.finalizeBill.mutate({ id: bill.id, wiseOrigin: origin(confirmed) })
			: encounterRecordApi.encounterRecord.markBillPaid.mutate({
					id: bill.id,
					orNumber: orNumber.trim(),
					wiseOrigin: origin(confirmed, orNumber !== (input.orNumber ?? '')),
				});
		return step
			.then(() => {
				void queryClient.invalidateQueries(encounterRecordApi.encounterRecord.get.pathFilter());
				void queueOrSendMessage({
					text: finalize ? 'I finalized the bill.' : `I marked the bill paid (OR ${orNumber.trim()}).`,
				});
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={ReceiptText}
			title={finalize ? 'Finalize bill' : 'Mark bill paid'}
			confirmLabel={finalize ? 'Finalize bill' : 'Mark paid'}
			resolved={finalize ? 'Finalized' : 'Paid'}
			answer={finalize ? 'I finalized the bill' : 'I marked the bill paid'}
			confirmStrength={finalize ? 'strong' : 'standard'}
			onConfirm={confirm}
			isPending={pending}
			isConfirmDisabled={!finalize && !orNumber.trim()}
			error={error}
		>
			<VisitLink record={record} tab='billing' />
			<p className={styles.summary} data-testid='bill-step'>
				{label} · {bill.charges.length} charge{bill.charges.length === 1 ? '' : 's'}
			</p>
			{finalize ? (
				<p className={styles.meta}>
					Locked once finalized; it can then only be paid or voided. You confirm twice.
				</p>
			) : (
				<FormField label='Official receipt (OR) number'>
					{(id) => (
						<Input
							id={id}
							value={orNumber}
							disabled={pending}
							onChange={(event) => setOrNumber(event.target.value)}
						/>
					)}
				</FormField>
			)}
		</ActionCard>
	);
}

type ReportVersion = { toolCallId: string; output: report.Output };

/** The report versions of this chat, by the report's id. */
function useReportVersions(reportId: string): ReportVersion[] {
	return useAgentMessagesSelector(
		(messages) =>
			messages.flatMap((message) =>
				message.parts.flatMap((part) => {
					const candidate = part as {
						type: string;
						toolCallId?: string;
						state?: string;
						output?: report.Output;
					};
					return candidate.type === 'tool-report' &&
						candidate.state === 'output-available' &&
						candidate.output?.id === reportId &&
						candidate.toolCallId
						? [{ toolCallId: candidate.toolCallId, output: candidate.output }]
						: [];
				}),
			),
		(left, right) => left.length === right.length,
	);
}

/** `propose_save_report`: saves one version of a report about this patient to the chart's documents. */
export const ProposeSaveReportToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_save_report'>) => (
	<ActionFrame<ProposeSaveReportInput> toolPart={toolPart}>
		{(input, output) => <SaveReportCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function SaveReportCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposeSaveReportInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage, chatId } = useAgentContext();
	const versions = useReportVersions(input.reportId);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const chosen =
		versions.find((version) => version.output.version === input.version) ??
		[...versions].sort((a, b) => b.output.version - a.output.version)[0];
	if (!chosen) {
		return <Missing message="That report isn't in this chat." />;
	}
	if (chosen.output.patientId !== output.patientId) {
		return <Missing message="That report isn't about this patient." />;
	}
	const confirm = (confirmed: ProposalConfirm) => {
		if (!chatId) {
			return;
		}
		setPending(true);
		setError(undefined);
		return wiseActionsApi.saveReportToChart
			.mutate({ chatId, toolCallId: chosen.toolCallId, wiseOrigin: origin(confirmed) })
			.then(() => {
				void queryClient.invalidateQueries();
				void queueOrSendMessage({ text: `I saved the report to the chart: ${chosen.output.title}.` });
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={BookmarkPlus}
			title='Save report to chart'
			confirmLabel='Save to chart'
			resolved='Saved to the chart'
			answer='I saved the report to the chart'
			onConfirm={confirm}
			isPending={pending}
			error={error}
		>
			<p className={styles.summary} data-testid='save-report'>
				<strong>{chosen.output.title}</strong> · v{chosen.output.version}
			</p>
			<p className={styles.meta}>Frozen as it is now, in the chart&apos;s Documents.</p>
		</ActionCard>
	);
}

const CONTACT_FIELDS = [
	['phone', 'Phone'],
	['preferredLanguage', 'Preferred language'],
	['barangay', 'Barangay'],
] as const;

/** `propose_patient_update`: the patient's contact details, before → after. */
export const ProposePatientUpdateToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_patient_update'>) => (
	<ActionFrame<ProposePatientUpdateInput> toolPart={toolPart}>
		{(input, output) => <PatientUpdateCard toolPart={toolPart} input={input} output={output} />}
	</ActionFrame>
));

function PatientUpdateCard({
	toolPart,
	input,
	output,
}: {
	toolPart: ToolPart;
	input: ProposePatientUpdateInput;
	output: ActionOutput;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const patient = useQuery(wiseActionsApi.patientContact.queryOptions({ id: output.patientId ?? '' }));
	const [initial] = useState(() =>
		Object.fromEntries(
			CONTACT_FIELDS.flatMap(([field]) => (input[field] === undefined ? [] : [[field, input[field] ?? '']])),
		),
	);
	const [values, setValues] = useState<Record<string, string>>(initial);
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	if (patient.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (!patient.data) {
		return <Missing message={patient.error?.message ?? "You can't see this patient."} />;
	}
	const current = patient.data;
	const changed = CONTACT_FIELDS.filter(
		([field]) => field in values && (values[field] ?? '') !== (current[field] ?? ''),
	);
	const confirm = (confirmed: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		return wiseActionsApi.updatePatient
			.mutate({
				patientId: current.id,
				...Object.fromEntries(changed.map(([field]) => [field, values[field]])),
				wiseOrigin: origin(confirmed, isEdited(values, initial)),
			})
			.then(() => {
				void queryClient.invalidateQueries();
				void queueOrSendMessage({
					text: `I updated the contact details: ${changed.map(([, label]) => label.toLowerCase()).join(', ')}.`,
				});
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={Phone}
			title='Update contact details'
			confirmLabel='Save changes'
			resolved='Contact details updated'
			answer='I updated the contact details'
			onConfirm={confirm}
			isPending={pending}
			isConfirmDisabled={changed.length === 0}
			error={error}
		>
			<p className={styles.meta}>
				{current.givenName} {current.familyName} · names, birth date and identifiers are not changed here
			</p>
			<div className={styles.grid}>
				{CONTACT_FIELDS.filter(([field]) => field in values).map(([field, label]) => (
					<FormField key={field} label={label}>
						{(id) => (
							<>
								<Input
									id={id}
									value={values[field]}
									disabled={pending}
									onChange={(event) => setValues({ ...values, [field]: event.target.value })}
								/>
								<span className={styles.meta} data-testid={`contact-before-${field}`}>
									Before: {current[field] || '—'}
								</span>
							</>
						)}
					</FormField>
				))}
			</div>
		</ActionCard>
	);
}
