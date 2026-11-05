import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DISCOUNT_LABELS, formatPesos, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@loopwise/shared/invoice';
import { ReceiptText, XCircle } from 'lucide-react';
import { memo, useState } from 'react';
import { diffFields } from './proposal-card/diff-fields';
import { ProposalCard } from './proposal-card/proposal-card';
import { ActionCard, ActionFrame, EncounterGate, isEdited, VisitLink } from './propose-action';
import styles from './propose-action.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { ToolPart } from './propose-action';
import type { encounterProposal, proposeCharges } from '@loopwise/shared/tools';
import type { ActionOutput, ProposeBillStepInput } from '@loopwise/shared/wise-actions';
import type { ToolCallComponentProps } from '.';
import type { InvoiceFormValues, PaymentFormValues } from '@/feature/encounters/billing-form-values';
import type {
	EncounterBillingFieldsFragment,
	EncounterRecordFieldsFragment,
	InvoiceFieldsFragment,
} from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import {
	activeInvoice,
	emptyInvoiceLine,
	idNumberOnFile,
	invoiceFormFrom,
	invoiceFormTotals,
	lineFromPriceItem,
	toRecordPaymentInput,
	toSaveInvoiceDraftInput,
	validateInvoiceForm,
	validatePaymentForm,
} from '@/feature/encounters/billing-form-values';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

/*
 * The billing cards of Wise (DESIGN.md §7.1, §7.3): `propose_charges` drafts the visit's invoice from the clinic's
 * price list, `propose_bill_step` issues it, records a payment or voids it. Each loads the visit as the clinician and
 * its billing, and only Confirm calls the billing mutation, with the card's `wiseOrigin` and the version it showed.
 */

const origin = (confirm: ProposalConfirm, edited = false) => ({ ...confirm.origin, edited });

const INVOICE_LABELS = { lines: 'Lines', discount: 'Discount', total: 'Amount due' };

/** The visit's billing, read as the clinician, for a card that already knows the visit is the chat patient's. */
function BillingGate({
	encounterId,
	children,
}: {
	encounterId: string;
	children: (billing: EncounterBillingFieldsFragment) => ReactNode;
}) {
	const billing = useQuery(billingApi.billing.get.queryOptions({ encounterId }));
	if (billing.isPending) {
		return <Skeleton className={styles.skeleton} />;
	}
	if (billing.error) {
		return <ErrorMessage message={billing.error.message} />;
	}
	return children(billing.data);
}

/** The draft as the card shows it: Wise's lines at the clinic's prices (or the suggested ones), and its discount. */
export function invoiceFormFromProposal(
	draft: proposeCharges.Input,
	billing: EncounterBillingFieldsFragment,
): InvoiceFormValues {
	const base = invoiceFormFrom({ ...billing, invoices: [] });
	const lines =
		draft.lines && draft.lines.length > 0
			? draft.lines.map((line) => {
					const name = line.description.trim().toLowerCase();
					const item = billing.priceList.find(
						(candidate) => candidate.name.toLowerCase() === name || candidate.code.toLowerCase() === name,
					);
					const quantity = String(line.quantity ?? 1);
					const priced = item ? lineFromPriceItem(item, quantity) : { ...emptyInvoiceLine(), quantity };
					return {
						...priced,
						description: item ? priced.description : line.description,
						unitPrice: line.unitPrice !== undefined ? String(line.unitPrice) : priced.unitPrice,
					};
				})
			: base.lines;
	const discountType = draft.discountType ?? '';
	return {
		lines,
		discountType,
		discountIdNumber: discountType ? (draft.discountIdNumber ?? idNumberOnFile(billing, discountType)) : '',
	};
}

const linesText = (lines: { description: string; quantity: string | number; total: number }[]) =>
	lines.map((line) => `${line.description} ×${line.quantity} · ${formatPesos(line.total)}`).join('\n');

// ---- propose_charges --------------------------------------------------------------------------------------------

export const ProposeChargesToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_charges'>) => (
	<ActionFrame<proposeCharges.Input> toolPart={toolPart}>
		{(input, output) => {
			const proposal = output as unknown as encounterProposal.Output;
			const gateOutput: ActionOutput = {
				success: true,
				patientId: proposal.patientId,
				subjectId: proposal.encounterId,
			};
			return (
				<EncounterGate output={gateOutput}>
					{(record) => (
						<BillingGate encounterId={record.encounter.id}>
							{(billing) => (
								<ChargesCard toolPart={toolPart} draft={input} record={record} billing={billing} />
							)}
						</BillingGate>
					)}
				</EncounterGate>
			);
		}}
	</ActionFrame>
));

function ChargesCard({
	toolPart,
	draft,
	record,
	billing,
}: {
	toolPart: ToolPart;
	draft: proposeCharges.Input;
	record: EncounterRecordFieldsFragment;
	billing: EncounterBillingFieldsFragment;
}) {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [values] = useState<InvoiceFormValues>(() => invoiceFormFromProposal(draft, billing));
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const errors = validateInvoiceForm(values);
	const totals = invoiceFormTotals(values);
	const active = activeInvoice(billing);
	const locked = active && active.status !== 'DRAFT' ? active : null;
	const existingDraft = active?.status === 'DRAFT' ? active : null;
	const firstError = Object.values(errors)[0];

	const confirm = ({ origin: cardOrigin }: ProposalConfirm) => {
		setPending(true);
		setError(undefined);
		return billingApi.billing.saveDraft
			.mutate({
				...toSaveInvoiceDraftInput(record.encounter.id, values, existingDraft?.version ?? null),
				wiseOrigin: { ...cardOrigin, edited: false },
			})
			.then(() => {
				void queryClient.invalidateQueries(billingApi.billing.get.pathFilter());
				void queueOrSendMessage({ text: `I saved the invoice draft: ${formatPesos(totals.netAmount)}.` });
			})
			.catch((caught: Error) => {
				setError(caught.message);
				throw caught;
			})
			.finally(() => setPending(false));
	};

	const after = {
		lines: linesText(
			values.lines.map((line, index) => ({
				description: line.description,
				quantity: line.quantity,
				total: totals.lines[index]?.lineTotal ?? 0,
			})),
		),
		discount: values.discountType
			? `${DISCOUNT_LABELS[values.discountType]} ${formatPesos(totals.scPwdDiscount)}`
			: '',
		total: formatPesos(totals.netAmount),
	};

	return (
		<ProposalCard
			{...(existingDraft
				? {
						mode: 'update' as const,
						target: { label: 'Draft invoice', detail: 'replaces the draft on this visit' },
						changes: diffFields(invoiceSummary(existingDraft), after, INVOICE_LABELS),
					}
				: { mode: 'create' as const })}
			toolCallId={toolPart.toolCallId}
			toolName='propose_charges'
			icon={ReceiptText}
			title='Invoice'
			testId='propose-charges'
			confirmLabel='Save draft invoice'
			isConfirmDisabled={Boolean(locked) || Boolean(firstError) || !billing.canDraft}
			onConfirm={confirm}
			isPending={pending}
			error={error}
			resolvedLabels={{ confirmed: 'Saved as draft', cancelled: 'Not saved' }}
			isConfirmedAnswer={(answer) => answer.startsWith('I saved the invoice draft')}
		>
			<VisitLink record={record} tab='billing' />
			<ul className={styles.list} data-testid='drafted-invoice-lines'>
				{values.lines.map((line, index) => (
					<li key={index}>
						{line.description} ×{line.quantity} ·{' '}
						{line.unitPrice ? formatPesos(totals.lines[index]?.lineTotal ?? 0) : 'no price'}
					</li>
				))}
			</ul>
			<p className={styles.summary}>
				Amount due <strong>{formatPesos(totals.netAmount)}</strong>
				{values.discountType && (
					<span className={styles.meta}>
						{' '}
						({DISCOUNT_LABELS[values.discountType]} −
						{formatPesos(totals.scPwdDiscount + totals.lessVatScPwd)}
						{values.discountIdNumber && `, ID ${values.discountIdNumber}`})
					</span>
				)}
			</p>
			{!billing.canDraft && <p className={styles.error}>Your role at this clinic does not draft invoices.</p>}
			{locked && (
				<p className={styles.error}>
					The invoice is already {INVOICE_STATUS_LABELS[locked.status].toLowerCase()}; void it first.
				</p>
			)}
			{!locked && firstError && <p className={styles.error}>{firstError}</p>}
			<p className={styles.meta}>Adjust the lines on the Billing tab before issuing.</p>
		</ProposalCard>
	);
}

function invoiceSummary(invoice: InvoiceFieldsFragment) {
	const discount = invoice.discounts[0];
	return {
		lines: linesText(
			invoice.lines.map((line) => ({
				description: line.description,
				quantity: line.quantity,
				total: line.lineTotal,
			})),
		),
		discount:
			discount && (discount.type === 'SENIOR_CITIZEN' || discount.type === 'PWD')
				? `${DISCOUNT_LABELS[discount.type]} ${formatPesos(discount.amount)}`
				: '',
		total: formatPesos(invoice.netAmount),
	};
}

// ---- propose_bill_step ------------------------------------------------------------------------------------------

/** `propose_bill_step`: issue (strong), record a payment, or void (reason) the visit's invoice. */
export const ProposeBillStepToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_bill_step'>) => (
	<ActionFrame<ProposeBillStepInput> toolPart={toolPart}>
		{(input, output) => (
			<EncounterGate output={output}>
				{(record) => (
					<BillingGate encounterId={record.encounter.id}>
						{(billing) => (
							<BillStepCard toolPart={toolPart} input={input} record={record} billing={billing} />
						)}
					</BillingGate>
				)}
			</EncounterGate>
		)}
	</ActionFrame>
));

function BillStepCard({
	toolPart,
	input,
	record,
	billing,
}: {
	toolPart: ToolPart;
	input: ProposeBillStepInput;
	record: EncounterRecordFieldsFragment;
	billing: EncounterBillingFieldsFragment;
}) {
	const invoice = activeInvoice(billing);
	if (!invoice) {
		return <ErrorMessage message='This visit has no invoice. Draft it first.' />;
	}
	const label = `${invoice.invoiceNo ? `Invoice ${invoice.invoiceNo}` : 'Draft invoice'} · ${formatPesos(invoice.netAmount)} · ${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}`;
	if (input.step === 'void') {
		return <VoidInvoiceCard toolPart={toolPart} input={input} invoice={invoice} label={label} />;
	}
	if (input.step === 'pay') {
		return <PaymentCard toolPart={toolPart} input={input} record={record} invoice={invoice} label={label} />;
	}
	return <IssueCard toolPart={toolPart} record={record} invoice={invoice} label={label} />;
}

/** Runs a billing step from a card: refreshes the billing and tells Wise what happened, or shows the error. */
function useStep() {
	const queryClient = useQueryClient();
	const { queueOrSendMessage } = useAgentContext();
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);
	const run = (step: () => Promise<unknown>, answer: string) => {
		setPending(true);
		setError(undefined);
		return step()
			.then(() => {
				void queryClient.invalidateQueries(billingApi.billing.get.pathFilter());
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

function IssueCard({
	toolPart,
	record,
	invoice,
	label,
}: {
	toolPart: ToolPart;
	record: EncounterRecordFieldsFragment;
	invoice: InvoiceFieldsFragment;
	label: string;
}) {
	const step = useStep();
	const notDraft = invoice.status !== 'DRAFT';
	return (
		<ActionCard
			toolPart={toolPart}
			icon={ReceiptText}
			title='Issue invoice'
			confirmLabel='Issue invoice'
			resolved='Issued'
			answer='I issued the invoice'
			confirmStrength='strong'
			onConfirm={(confirmed) =>
				step.run(
					() =>
						billingApi.billing.issue.mutate({
							id: invoice.id,
							expectedVersion: invoice.version,
							wiseOrigin: origin(confirmed),
						}),
					'I issued the invoice.',
				)
			}
			isPending={step.pending}
			isConfirmDisabled={notDraft}
			error={step.error}
		>
			<VisitLink record={record} tab='billing' />
			<p className={styles.summary} data-testid='bill-step'>
				{label} · {invoice.lines.length} line{invoice.lines.length === 1 ? '' : 's'}
			</p>
			<p className={notDraft ? styles.error : styles.meta}>
				{notDraft
					? 'This invoice is already issued.'
					: 'Numbered and locked once issued; it can then only be paid or voided. You confirm twice.'}
			</p>
		</ActionCard>
	);
}

function PaymentCard({
	toolPart,
	input,
	record,
	invoice,
	label,
}: {
	toolPart: ToolPart;
	input: ProposeBillStepInput;
	record: EncounterRecordFieldsFragment;
	invoice: InvoiceFieldsFragment;
	label: string;
}) {
	const step = useStep();
	const [initial] = useState<PaymentFormValues>(() => ({
		method: input.method ?? 'CASH',
		amount: String(input.amount ?? invoice.balance),
		tenderedAmount: input.tenderedAmount !== undefined ? String(input.tenderedAmount) : '',
		referenceNo: input.referenceNo ?? '',
	}));
	const [values, setValues] = useState(initial);
	const payable = invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID';
	const errors = validatePaymentForm(values, invoice.balance);
	const firstError = Object.values(errors)[0];
	return (
		<ActionCard
			toolPart={toolPart}
			icon={ReceiptText}
			title='Record payment'
			confirmLabel='Record payment'
			resolved='Paid'
			answer='I recorded the payment'
			onConfirm={(confirmed) =>
				step.run(
					() =>
						billingApi.billing.recordPayment.mutate({
							...toRecordPaymentInput(invoice, values),
							wiseOrigin: origin(confirmed, isEdited(values, initial)),
						}),
					`I recorded the payment: ${PAYMENT_METHOD_LABELS[values.method]} ${formatPesos(Number(values.amount))} (${values.referenceNo.trim()}).`,
				)
			}
			isPending={step.pending}
			isConfirmDisabled={!payable || Boolean(firstError)}
			error={step.error}
		>
			<VisitLink record={record} tab='billing' />
			<p className={styles.summary} data-testid='bill-step'>
				{label} · balance {formatPesos(invoice.balance)}
			</p>
			<p className={styles.meta}>
				{PAYMENT_METHOD_LABELS[values.method]} {values.amount && formatPesos(Number(values.amount))}
			</p>
			<FormField label='Receipt or reference number' error={values.referenceNo ? errors.referenceNo : undefined}>
				{(id) => (
					<Input
						id={id}
						value={values.referenceNo}
						disabled={step.pending}
						onChange={(event) => setValues({ ...values, referenceNo: event.target.value })}
					/>
				)}
			</FormField>
			{!payable && <p className={styles.error}>Only an issued invoice takes payments.</p>}
			{payable && firstError && values.referenceNo && <p className={styles.error}>{firstError}</p>}
		</ActionCard>
	);
}

function VoidInvoiceCard({
	toolPart,
	input,
	invoice,
	label,
}: {
	toolPart: ToolPart;
	input: ProposeBillStepInput;
	invoice: InvoiceFieldsFragment;
	label: string;
}) {
	const step = useStep();
	return (
		<ActionCard
			toolPart={toolPart}
			icon={XCircle}
			title='Void invoice'
			confirmLabel='Void invoice'
			resolved='Done'
			answer='I voided the invoice'
			mode='destructive'
			target={{ label, detail: 'stays in the record, marked void, with its payments' }}
			onConfirm={(confirmed) =>
				step.run(
					() =>
						billingApi.billing.void.mutate({
							id: invoice.id,
							reason: confirmed.reason ?? '',
							expectedVersion: invoice.version,
							wiseOrigin: origin(confirmed),
						}),
					'I voided the invoice.',
				)
			}
			isPending={step.pending}
			error={step.error}
		>
			{input.reason && <p className={styles.meta}>Wise noted: {input.reason}</p>}
		</ActionCard>
	);
}
