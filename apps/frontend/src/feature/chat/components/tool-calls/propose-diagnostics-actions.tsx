import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { findLabTest } from '@loopwise/shared/lab-tests';
import { ClipboardCheck, ClipboardList, FlaskConical, TestTubes, XCircle } from 'lucide-react';
import { memo, useState } from 'react';
import { ActionCard, ActionFrame, EncounterGate, VisitLink } from './propose-action';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { ToolPart } from './propose-action';
import type { listLabOrders, listResultsToReview } from '@loopwise/shared/tools';
import type {
	ActionOutput,
	ProposeCancelOrderInput,
	ProposeLabOrderStepInput,
	ProposeOrderInput,
	ProposeResultReviewInput,
} from '@loopwise/shared/wise-actions';
import type { ToolCallComponentProps } from '.';
import type { OrderPriority } from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAgentContext } from '@/contexts/agent.provider';
import { FormField } from '@/feature/encounters/form-field';
import { CANCELLABLE, DIAGNOSTIC_STATUS, PRIORITY_LABELS, personName } from '@/feature/orders/order-format';
import { resultSummary, URGENCY_LABELS } from '@/feature/results/result-format';
import { ResultValues } from '@/feature/results/result-values';
import { ordersApi } from '@/lib/orders-api';
import { resultApi } from '@/lib/result-api';

/*
 * The cards of the diagnostics Wise actions (`@loopwise/shared/wise-actions`): requesting tests, cancelling one,
 * the lab desk's steps, and reviewing a released result. Each loads the record as the user (row-level security), and
 * only its Confirm calls the mutation, with the card's `wiseOrigin`. Critical values never get an automated patient
 * message.
 */

const PRIORITIES: OrderPriority[] = ['ROUTINE', 'URGENT', 'STAT'];

/** Runs a card's mutation with the card's pending and error state, then says what was done in the chat. */
function useCardRun() {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const run = (mutation: () => Promise<unknown>, answer: string) => {
		setPending(true);
		setError(undefined);
		return mutation()
			.then(() => {
				void queryClient.invalidateQueries({ queryKey: ['order'] });
				void queryClient.invalidateQueries({ queryKey: ['result'] });
				void queueOrSendMessage({ text: answer });
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};
	return { run, error, pending };
}

/** `propose_result_review`: marks one released result reviewed with the clinician's note; a critical one needs it. */
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
	const results = useQuery(resultApi.result.forPatient.queryOptions({ patientId: output.patientId ?? '' }));
	const [note, setNote] = useState(input.note ?? '');
	const { run, error, pending } = useCardRun();
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
		return <p className={styles.meta}>{result.test.name} is already reviewed.</p>;
	}
	const isCritical = result.urgency === 'CRITICAL';

	const confirm = ({ origin }: ProposalConfirm) =>
		run(
			() =>
				resultApi.result.review.mutate({
					resultId: result.id,
					note: note.trim() || null,
					wiseOrigin: { ...origin, edited: note !== (input.note ?? '') },
				}),
			`I reviewed the result: ${result.test.name}.`,
		);

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
			isPending={pending}
			isConfirmDisabled={isCritical && !note.trim()}
			error={error}
			warnings={
				isCritical && (
					<p className={styles.critical} role='alert'>
						Critical value: act now. Note what you did (called the patient, referred); you confirm twice.
					</p>
				)
			}
		>
			<p className={styles.summary} data-testid='review-result'>
				<strong>{result.test.name}</strong> {resultSummary(result)} · {URGENCY_LABELS[result.urgency]} ·{' '}
				{result.order.orderNo}
			</p>
			<ResultValues result={result} />
			<FormField label={isCritical ? 'Note (required)' : 'Note'}>
				{(id) => (
					<Textarea
						id={id}
						rows={2}
						value={note}
						disabled={pending}
						onChange={(event) => setNote(event.target.value)}
					/>
				)}
			</FormField>
		</ActionCard>
	);
}

/** `propose_order`: tests for a visit from the clinic's catalog, one order for the clinic's own lab. */
export const ProposeOrderToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_order'>) => (
	<ActionFrame<ProposeOrderInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => (
					<OrderCard toolPart={toolPart} input={input} output={output} encounterId={record.encounter.id}>
						<VisitLink record={record} tab='orders' />
					</OrderCard>
				)}
			</EncounterGate>
		)}
	</ActionFrame>
));

function OrderCard({
	toolPart,
	input,
	output,
	encounterId,
	children,
}: {
	toolPart: ToolPart;
	input: ProposeOrderInput;
	output: ActionOutput;
	encounterId: string;
	children: ReactNode;
}) {
	const catalog = useQuery(ordersApi.order.tests.queryOptions(undefined));
	const [priority, setPriority] = useState<OrderPriority>(
		(input.priority?.toUpperCase() as OrderPriority | undefined) ?? 'ROUTINE',
	);
	const [clinicalInfo, setClinicalInfo] = useState(input.clinicalInfo ?? '');
	const { run, error, pending } = useCardRun();
	const drafted = output.tests ?? [];
	const offered = drafted.flatMap((test) => catalog.data?.filter((row) => row.code === test.code) ?? []);
	const missing = catalog.data ? drafted.filter((test) => !catalog.data.some((row) => row.code === test.code)) : [];

	const confirm = ({ origin }: ProposalConfirm) =>
		run(
			() =>
				ordersApi.order.create.mutate({
					encounterId,
					testIds: offered.map((test) => test.id),
					priority,
					clinicalInfo: clinicalInfo.trim() || null,
					wiseOrigin: {
						...origin,
						edited:
							priority !== (input.priority?.toUpperCase() ?? 'ROUTINE') ||
							clinicalInfo !== (input.clinicalInfo ?? ''),
					},
				}),
			`I ordered ${offered.map((test) => test.name).join(', ')}.`,
		);

	return (
		<ActionCard
			toolPart={toolPart}
			icon={TestTubes}
			title='Request tests'
			confirmLabel={offered.length > 1 ? `Order ${offered.length} tests` : 'Order test'}
			resolved='Ordered'
			answer='I ordered'
			onConfirm={confirm}
			isPending={pending}
			isConfirmDisabled={!catalog.data || offered.length === 0 || missing.length > 0}
			error={error ?? catalog.error?.message}
		>
			{children}
			<ul className={styles.list} data-testid='drafted-tests'>
				{drafted.map((test) => (
					<li key={test.code}>
						{test.display} <span className={styles.meta}>{test.code}</span>
					</li>
				))}
			</ul>
			{missing.length > 0 && (
				<p className={styles.error}>
					Not in the clinic's test list: {missing.map((test) => test.display).join(', ')}.
				</p>
			)}
			<div className={styles.grid}>
				<FormField label='Priority'>
					{(id) => (
						<select
							id={id}
							className={styles.select}
							value={priority}
							disabled={pending}
							onChange={(event) => setPriority(event.target.value as OrderPriority)}
						>
							{PRIORITIES.map((option) => (
								<option key={option} value={option}>
									{PRIORITY_LABELS[option]}
								</option>
							))}
						</select>
					)}
				</FormField>
				<FormField label='Clinical information' wide>
					{(id) => (
						<Input
							id={id}
							value={clinicalInfo}
							disabled={pending}
							onChange={(event) => setClinicalInfo(event.target.value)}
						/>
					)}
				</FormField>
			</div>
		</ActionCard>
	);
}

/** `propose_cancel_order`: the requesting doctor cancels one test of the visit before its result is in. */
export const ProposeCancelOrderToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_cancel_order'>) => (
	<ActionFrame<ProposeCancelOrderInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => <CancelOrderCard toolPart={toolPart} input={input} encounterId={record.encounter.id} />}
			</EncounterGate>
		)}
	</ActionFrame>
));

function CancelOrderCard({
	toolPart,
	input,
	encounterId,
}: {
	toolPart: ToolPart;
	input: ProposeCancelOrderInput;
	encounterId: string;
}) {
	const orders = useQuery(ordersApi.order.forEncounter.queryOptions({ encounterId }));
	const { run, error, pending } = useCardRun();
	if (orders.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (orders.error) {
		return <ErrorMessage message={orders.error.message} />;
	}
	const code = findLabTest(input.test)?.code;
	const wanted = input.test.trim().toLowerCase();
	const match = orders.data
		.flatMap((order) => order.items.map((item) => ({ order, item })))
		.find(
			({ item }) =>
				CANCELLABLE.includes(item.status) &&
				(item.test.code === code || item.test.name.toLowerCase() === wanted),
		);
	if (!match) {
		return <ErrorMessage message={`This visit has no ${input.test} test that can still be cancelled.`} />;
	}
	const { order, item } = match;
	const confirm = (confirmed: ProposalConfirm) =>
		run(
			() =>
				ordersApi.order.cancel.mutate({
					orderId: order.id,
					itemId: item.id,
					reason: confirmed.reason ?? '',
					wiseOrigin: { ...confirmed.origin, edited: false },
				}),
			`I cancelled the test: ${item.test.name}.`,
		);
	return (
		<ActionCard
			toolPart={toolPart}
			icon={XCircle}
			title='Cancel test'
			confirmLabel='Cancel test'
			resolved='Done'
			answer='I cancelled the test'
			mode='destructive'
			target={{
				label: `${item.test.name} · ${DIAGNOSTIC_STATUS[item.status].label}`,
				detail: `${order.orderNo}; the lab sees your reason`,
			}}
			onConfirm={confirm}
			isPending={pending}
			error={error}
		>
			{input.reason && <p className={styles.meta}>Wise noted: {input.reason}</p>}
		</ActionCard>
	);
}

const STEP_LABELS = {
	collect: 'Mark collected',
	start: 'Start the test',
	release: 'Release the result',
	cancel: 'Cancel the test',
} as const;

/** `propose_lab_order_step`: the lab desk collects, starts, releases or cancels one test on its worklist. */
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
	const worklist = useQuery(ordersApi.order.worklist.queryOptions({ statuses: null }));
	const [accessionNo, setAccessionNo] = useState(input.accessionNo ?? '');
	const { run, error, pending } = useCardRun();
	if (worklist.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (worklist.error) {
		return <ErrorMessage message={worklist.error.message} />;
	}
	const item = worklist.data.find((row) => row.id === output.subjectId);
	if (!item) {
		return <ErrorMessage message="That test isn't on your lab worklist, or it has moved on already." />;
	}
	const label = `${item.test.name} · ${PRIORITY_LABELS[item.order.priority]} · ${personName(item.patient)}`;
	const confirm = (confirmed: ProposalConfirm) => {
		const wiseOrigin = { ...confirmed.origin, edited: accessionNo !== (input.accessionNo ?? '') };
		const mutation = {
			collect: () =>
				ordersApi.order.collect.mutate({
					itemId: item.id,
					accessionNo: accessionNo.trim() || null,
					wiseOrigin,
				}),
			start: () => ordersApi.order.start.mutate({ itemId: item.id, wiseOrigin }),
			release: () => ordersApi.order.release.mutate({ itemId: item.id, wiseOrigin }),
			cancel: () =>
				ordersApi.order.cancel.mutate({
					orderId: item.order.id,
					itemId: item.id,
					reason: confirmed.reason ?? '',
					wiseOrigin,
				}),
		}[input.step];
		return run(mutation, `I did it: ${STEP_LABELS[input.step]} for ${item.test.name}.`);
	};
	return (
		<ActionCard
			toolPart={toolPart}
			icon={TestTubes}
			title={STEP_LABELS[input.step]}
			confirmLabel={STEP_LABELS[input.step]}
			resolved='Done'
			answer='I did it'
			mode={input.step === 'cancel' ? 'destructive' : 'create'}
			target={{ label, detail: `${item.order.orderNo}, requested by ${item.order.requestedByName ?? '—'}` }}
			onConfirm={confirm}
			isPending={pending}
			error={error}
		>
			{input.step !== 'cancel' && (
				<p className={styles.summary} data-testid='lab-order'>
					{label} · {DIAGNOSTIC_STATUS[item.status].label}
				</p>
			)}
			{input.step === 'collect' && (
				<FormField label='Accession number'>
					{(id) => (
						<Input
							id={id}
							value={accessionNo}
							placeholder={`${item.order.orderNo}-${item.test.code}`}
							disabled={pending}
							onChange={(event) => setAccessionNo(event.target.value)}
						/>
					)}
				</FormField>
			)}
			{input.step === 'release' && item.result && <ResultValues result={item.result} />}
			{input.reason && <p className={styles.meta}>Wise noted: {input.reason}</p>}
		</ActionCard>
	);
}

/** `list_results_to_review`: what Wise read from the inbox, critical first. */
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
							<strong>{result.test}</strong>{' '}
							{result.values.length > 0
								? result.values
										.map(
											(value) =>
												`${value.name} ${value.value}${value.unit ? ` ${value.unit}` : ''}`,
										)
										.join(', ')
								: (result.impression ?? 'Report')}{' '}
							· {URGENCY_LABELS[result.urgency.toUpperCase() as keyof typeof URGENCY_LABELS]} ·{' '}
							{result.patient.name}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});

/** `list_lab_orders`: the lab worklist Wise read, STAT first. */
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
				<ClipboardList aria-hidden /> Lab worklist ({output.orders.length}
				{output.truncated && '+'})
				<Link to='/orders' className={styles.link}>
					Open the worklist
				</Link>
			</p>
			{output.orders.length === 0 ? (
				<p className={styles.meta}>Nothing on the worklist.</p>
			) : (
				<ul className={styles.list}>
					{output.orders.map((order) => (
						<li key={order.id}>
							<strong>{order.test}</strong> · {PRIORITY_LABELS[order.priority]} ·{' '}
							{DIAGNOSTIC_STATUS[order.status as keyof typeof DIAGNOSTIC_STATUS]?.label ?? order.status} ·{' '}
							{order.patient.name} · {order.requestedBy}
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
