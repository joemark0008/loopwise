import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
	DISCOUNT_LABELS,
	formatPesos,
	INVOICE_STATUS_LABELS,
	OTHER_DISCOUNT_LABELS,
	PAYMENT_METHOD_LABELS,
	TAX_TYPE_LABELS,
} from '@loopwise/shared/invoice';
import { Download, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import {
	activeInvoice,
	emptyInvoiceLine,
	invoiceFormFrom,
	invoiceFormTotals,
	lineFromPriceItem,
	toSaveInvoiceDraftInput,
	validateInvoiceForm,
} from './billing-form-values';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { VoidDialog } from './void-dialog';
import type { InvoiceFormValues, InvoiceLineFormValues } from './billing-form-values';
import type { OtherDiscountType, StatutoryDiscountType } from '@loopwise/shared/invoice';
import type { UseMutationOptions } from '@tanstack/react-query';
import type {
	EncounterBillingFieldsFragment,
	EncounterRecordFieldsFragment,
	InvoiceFieldsFragment,
} from '@/graphql/generated/graphql';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import billingStyles from '@/feature/billing/billing.module.css';
import { DiscountFields } from '@/feature/billing/discount-fields';
import { PaymentForm } from '@/feature/billing/payment-form';
import { billingApi } from '@/lib/billing-api';

/** The badge of an invoice status (the shared badge speaks lower case). */
const badgeStatus = (status: InvoiceFieldsFragment['status']) => (status === 'VOID' ? 'voided' : status.toLowerCase());

/** A billing write: on success the visit's billing (and the cashier desk) is read again. */
function useBillingMutation<TInput, TOutput>(procedure: {
	mutationOptions: (
		opts?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn' | 'mutationKey'>,
	) => UseMutationOptions<TOutput, Error, TInput>;
}) {
	const queryClient = useQueryClient();
	return useMutation(
		procedure.mutationOptions({ onSuccess: () => queryClient.invalidateQueries(billingApi.invalidate) }),
	);
}

/**
 * The visit's invoice (BIR sales invoice): the doctor or the desk drafts it ("Load charges" brings the consultation,
 * the tests ordered and the medicines dispensed), with an SC/PWD discount from the ID on file or another approved
 * discount; issuing numbers it from the clinic's BIR series and locks it; the cashier then takes payments, split
 * across tenders, on their open shift, prints it, and an admin voids it with a reason.
 */
export function BillingTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const billing = useQuery(billingApi.billing.get.queryOptions({ encounterId: record.encounter.id }));
	if (billing.isPending) {
		return <Skeleton className={styles.section} />;
	}
	if (billing.error) {
		return <ErrorMessage message={billing.error.message} />;
	}
	const data = billing.data;
	const active = activeInvoice(data);
	const voided = data.invoices.filter((invoice) => invoice.status === 'VOID');

	return (
		<section className={styles.section}>
			<h3 className={styles.sectionTitle}>Invoice</h3>
			{active && active.status !== 'DRAFT' ? (
				<InvoiceCard billing={data} invoice={active} />
			) : data.canDraft ? (
				<InvoiceEditor key={`${active?.id ?? 'new'}-${active?.version ?? 0}`} billing={data} draft={active} />
			) : active ? (
				<InvoiceCard billing={data} invoice={active} />
			) : (
				<Empty>No invoice for this visit.</Empty>
			)}
			{voided.map((invoice) => (
				<InvoiceCard key={invoice.id} billing={data} invoice={invoice} />
			))}
		</section>
	);
}

/** The BIR breakdown: sales by tax type, VAT, the SC/PWD and other discounts, withholding and the amount due. */
export function InvoiceTotals({
	totals,
	discountType,
	otherDiscountType,
	payments,
}: {
	totals: {
		grossAmount: number;
		vatableSales: number;
		vatExemptSales: number;
		zeroRatedSales: number;
		vatAmount: number;
		lessVatScPwd: number;
		scPwdDiscount: number;
		otherDiscount?: number;
		withholdingTax?: number;
		netAmount: number;
	};
	discountType: StatutoryDiscountType | null;
	otherDiscountType?: OtherDiscountType | null;
	payments?: { amountPaid: number; balance: number };
}) {
	const row = (label: string, value: number, strong = false) => (
		<tr key={label}>
			<td>{strong ? <strong>{label}</strong> : label}</td>
			<td data-numeric>{strong ? <strong>{formatPesos(value)}</strong> : formatPesos(value)}</td>
		</tr>
	);
	return (
		<table className={styles.table} data-testid='invoice-totals'>
			<tbody>
				{row('Total sales', totals.grossAmount)}
				{totals.vatableSales > 0 && row('VATable sales', totals.vatableSales)}
				{totals.vatAmount > 0 && row('VAT (12%)', totals.vatAmount)}
				{totals.vatExemptSales > 0 && row('VAT-exempt sales', totals.vatExemptSales)}
				{totals.zeroRatedSales > 0 && row('Zero-rated sales', totals.zeroRatedSales)}
				{discountType && totals.lessVatScPwd > 0 && row('Less: VAT (SC/PWD)', -totals.lessVatScPwd)}
				{discountType && row(`Less: ${DISCOUNT_LABELS[discountType]}`, -totals.scPwdDiscount)}
				{otherDiscountType &&
					(totals.otherDiscount ?? 0) > 0 &&
					row(`Less: ${OTHER_DISCOUNT_LABELS[otherDiscountType]} discount`, -(totals.otherDiscount ?? 0))}
				{(totals.withholdingTax ?? 0) > 0 && row('Less: withholding tax', -(totals.withholdingTax ?? 0))}
				{row('Amount due', totals.netAmount, true)}
				{payments && row('Paid', payments.amountPaid)}
				{payments && row('Balance', payments.balance, true)}
			</tbody>
		</table>
	);
}

function InvoiceLines({ lines }: { lines: InvoiceFieldsFragment['lines'] }) {
	return (
		<div className={styles.tableScroll} role='region' aria-label='Invoice lines' tabIndex={0}>
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Item</th>
						<th>Qty</th>
						<th>Price</th>
						<th>Amount</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((line) => (
						<tr key={line.id}>
							<td>
								{line.description}
								{line.taxType !== 'VAT_EXEMPT' && (
									<span className={styles.muted}> · {TAX_TYPE_LABELS[line.taxType]}</span>
								)}
								{line.isProfessionalFee && line.practitionerName && (
									<span className={styles.muted}> · PF {line.practitionerName}</span>
								)}
							</td>
							<td data-numeric>{line.quantity}</td>
							<td data-numeric>{formatPesos(line.unitPrice)}</td>
							<td data-numeric>{formatPesos(line.lineTotal)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

const statutoryOf = (invoice: InvoiceFieldsFragment) => {
	const discount = invoice.discounts.find((row) => row.type === 'SENIOR_CITIZEN' || row.type === 'PWD');
	return discount && (discount.type === 'SENIOR_CITIZEN' || discount.type === 'PWD') ? discount : null;
};
const otherOf = (invoice: InvoiceFieldsFragment) =>
	invoice.discounts.find((row) => row.type === 'EMPLOYEE' || row.type === 'PROMO' || row.type === 'SPECIAL') ?? null;

/** An issued, paid or voided invoice (or a draft, read-only, for staff who don't bill). */
function InvoiceCard({
	billing,
	invoice,
}: {
	billing: EncounterBillingFieldsFragment;
	invoice: InvoiceFieldsFragment;
}) {
	const [isVoiding, setIsVoiding] = useState(false);
	const [voidingPayment, setVoidingPayment] = useState<string | null>(null);
	const voidInvoice = useBillingMutation(billingApi.billing.void);
	const voidPayment = useBillingMutation(billingApi.billing.voidPayment);
	const statutory = statutoryOf(invoice);
	const other = otherOf(invoice);
	const payable = invoice.status === 'ISSUED' || invoice.status === 'PARTIALLY_PAID';

	return (
		<article className={styles.card} data-testid='invoice-card'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					{invoice.invoiceNo ? `Sales invoice ${invoice.invoiceNo}` : 'Draft invoice'}
					{invoice.issuedAt && (
						<span className={styles.muted}> · issued {formatDateTime(invoice.issuedAt)}</span>
					)}
				</span>
				<span className={styles.actions}>
					<StatusBadge status={badgeStatus(invoice.status)} title={INVOICE_STATUS_LABELS[invoice.status]} />
					{invoice.status !== 'DRAFT' && (
						<Button size='sm' variant='ghost' asChild>
							<Link to='/print/invoice/$invoiceId' params={{ invoiceId: invoice.id }} target='_blank'>
								<Printer />
								Print
							</Link>
						</Button>
					)}
					{billing.canVoid && invoice.status !== 'VOID' && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsVoiding(true)}>
							Void
						</Button>
					)}
				</span>
			</div>
			<p className={styles.muted}>Sold to {invoice.buyerName}</p>
			<InvoiceLines lines={invoice.lines} />
			{statutory && (
				<p className={styles.muted} data-testid='invoice-discount'>
					{DISCOUNT_LABELS[statutory.type as StatutoryDiscountType]} · {statutory.beneficiaryName} · ID{' '}
					{statutory.idNumber ?? 'not recorded'}
				</p>
			)}
			{other && (
				<p className={styles.muted} data-testid='invoice-other-discount'>
					{OTHER_DISCOUNT_LABELS[other.type as OtherDiscountType]} discount · approved by{' '}
					{billing.discountApprovers.find((approver) => approver.userId === other.approvedById)?.name ??
						'a clinic approver'}
				</p>
			)}
			<InvoiceTotals
				totals={invoice}
				discountType={statutory ? (statutory.type as StatutoryDiscountType) : null}
				otherDiscountType={other ? (other.type as OtherDiscountType) : null}
				payments={invoice.status === 'DRAFT' ? undefined : invoice}
			/>
			{invoice.payments.length > 0 && (
				<ul className={styles.muted} data-testid='invoice-payments'>
					{invoice.payments.map((payment) => (
						<li key={payment.id}>
							{PAYMENT_METHOD_LABELS[payment.method]} {formatPesos(payment.amount)}
							{payment.referenceNo && ` · ${payment.referenceNo}`}
							{payment.bankName && ` · ${payment.bankName}`}
							{payment.changeAmount ? ` · change ${formatPesos(payment.changeAmount)}` : ''} ·{' '}
							{payment.paymentNo}
							{payment.status !== 'POSTED' && ` · ${payment.status.toLowerCase()}`}
							{payment.voidReason && ` (${payment.voidReason})`}
							{billing.canVoid && payment.status === 'POSTED' && invoice.status !== 'VOID' && (
								<>
									{' '}
									<Button
										size='sm'
										variant='ghost-muted'
										onClick={() => setVoidingPayment(payment.id)}
										aria-label={`Void payment ${payment.paymentNo}`}
									>
										Void
									</Button>
								</>
							)}
						</li>
					))}
				</ul>
			)}
			{invoice.voidReason && <p className={styles.muted}>Voided: {invoice.voidReason}</p>}
			{billing.canCollect &&
				payable &&
				(billing.openShiftId ? (
					<PaymentForm key={invoice.version} invoice={invoice} />
				) : (
					<p className={billingStyles.notice} data-testid='no-open-shift'>
						Open your cashier shift to take payments. <Link to='/cashier'>Go to the cashier desk</Link>
					</p>
				))}
			<VoidDialog
				open={isVoiding}
				onOpenChange={setIsVoiding}
				title='Void invoice'
				description='The invoice keeps its number, marked void with your reason, and its payments are voided; a new one can then be drafted.'
				isPending={voidInvoice.isPending}
				error={voidInvoice.error?.message}
				onVoid={(reason) =>
					voidInvoice.mutate(
						{ id: invoice.id, reason, expectedVersion: invoice.version },
						{ onSuccess: () => setIsVoiding(false) },
					)
				}
			/>
			<VoidDialog
				open={voidingPayment !== null}
				onOpenChange={(open) => !open && setVoidingPayment(null)}
				title='Void payment'
				description='The payment stays on the record, marked void with your reason; the invoice gets its balance back.'
				isPending={voidPayment.isPending}
				error={voidPayment.error?.message}
				onVoid={(reason) =>
					voidingPayment &&
					voidPayment.mutate(
						{ paymentId: voidingPayment, reason },
						{ onSuccess: () => setVoidingPayment(null) },
					)
				}
			/>
		</article>
	);
}

/** The draft: "Load charges" from the visit, lines from the price list or free text, discounts, then save and issue. */
function InvoiceEditor({
	billing,
	draft,
}: {
	billing: EncounterBillingFieldsFragment;
	draft: InvoiceFieldsFragment | null;
}) {
	// The saved draft as the form shows it: after a save, the refetched draft equals the form again.
	const initial = invoiceFormFrom(billing);
	const [values, setValues] = useState<InvoiceFormValues>(initial);
	const [showErrors, setShowErrors] = useState(false);
	const save = useBillingMutation(billingApi.billing.saveDraft);
	const load = useBillingMutation(billingApi.billing.loadCharges);
	const issue = useBillingMutation(billingApi.billing.issue);
	const errors = validateInvoiceForm(values);
	const totals = invoiceFormTotals(values, billing.vatRegistered);
	const isDirty = JSON.stringify(values) !== JSON.stringify(initial) || !draft;
	const busy = save.isPending || issue.isPending || load.isPending;
	const error = (key: string) => (showErrors ? errors[key] : undefined);
	const setLine = (index: number, line: InvoiceLineFormValues) =>
		setValues({ ...values, lines: values.lines.map((current, i) => (i === index ? line : current)) });
	const failure = save.error ?? load.error ?? issue.error;

	return (
		<form
			className={styles.card}
			noValidate
			data-testid='invoice-editor'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (Object.keys(errors).length === 0) {
					save.mutate(toSaveInvoiceDraftInput(billing.encounterId, values, draft?.version ?? null), {
						onSuccess: () => setShowErrors(false),
					});
				}
			}}
		>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>{draft ? 'Draft invoice' : 'New invoice'}</span>
				<span className={styles.actions}>
					<Button
						type='button'
						size='sm'
						variant='outline'
						disabled={busy || Boolean(draft && isDirty)}
						title={
							draft && isDirty
								? 'Save the draft first'
								: 'The consultation, tests and medicines dispensed'
						}
						onClick={() =>
							load.mutate({ encounterId: billing.encounterId, expectedVersion: draft?.version ?? null })
						}
					>
						<Download />
						Load charges
					</Button>
					<StatusBadge status='draft' />
				</span>
			</div>
			<div className={styles.itemRows}>
				{values.lines.map((line, index) => (
					<div key={index} className={styles.itemRow} data-testid='invoice-line'>
						<div className={styles.fields}>
							<FormField label='Item' wide error={error(`lines.${index}.description`)}>
								{(id) => (
									<Input
										id={id}
										list='price-list'
										value={line.description}
										onChange={(event) => {
											const item = billing.priceList.find(
												(candidate) => candidate.name === event.target.value,
											);
											setLine(
												index,
												item
													? lineFromPriceItem(item, line.quantity)
													: {
															...line,
															serviceItemId: '',
															category: '',
															description: event.target.value,
														},
											);
										}}
										disabled={busy}
									/>
								)}
							</FormField>
							<FormField label='Quantity' error={error(`lines.${index}.quantity`)}>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={line.quantity}
										onChange={(event) => setLine(index, { ...line, quantity: event.target.value })}
										disabled={busy}
									/>
								)}
							</FormField>
							<FormField label='Price' unit='₱' error={error(`lines.${index}.unitPrice`)}>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={line.unitPrice}
										onChange={(event) => setLine(index, { ...line, unitPrice: event.target.value })}
										disabled={busy}
									/>
								)}
							</FormField>
						</div>
						<div className={styles.actions}>
							<span className={styles.muted}>
								{line.serviceItemId ? TAX_TYPE_LABELS[line.taxType] : 'Not on the price list'}
								{line.practitionerId ? ' · doctor’s fee' : ''} ·{' '}
								{formatPesos(totals.lines[index]?.lineTotal ?? 0)}
							</span>
							{values.lines.length > 1 && (
								<Button
									type='button'
									size='sm'
									variant='ghost-muted'
									onClick={() =>
										setValues({ ...values, lines: values.lines.filter((_, i) => i !== index) })
									}
								>
									<Trash2 />
									Remove
								</Button>
							)}
						</div>
					</div>
				))}
			</div>
			<datalist id='price-list'>
				{billing.priceList.map((item) => (
					<option key={item.id} value={item.name} />
				))}
			</datalist>
			{showErrors && errors.lines && <p className={styles.fieldError}>{errors.lines}</p>}
			<div className={styles.actions}>
				<Button
					type='button'
					size='sm'
					variant='ghost'
					onClick={() => setValues({ ...values, lines: [...values.lines, emptyInvoiceLine()] })}
				>
					<Plus />
					Add line
				</Button>
			</div>
			<DiscountFields billing={billing} values={values} onChange={setValues} errors={error} disabled={busy} />
			{showErrors && errors.otherDiscountType && <p className={styles.fieldError}>{errors.otherDiscountType}</p>}
			<InvoiceTotals
				totals={totals}
				discountType={values.discountType || null}
				otherDiscountType={values.otherDiscountType || null}
			/>
			<p className={styles.muted}>
				{billing.vatRegistered ? 'VAT-registered clinic.' : 'Non-VAT clinic: no VAT is added.'} PhilHealth
				package coverage (e.g. Konsulta) is recorded as a PhilHealth payment once the invoice is issued.
			</p>
			{failure && <ErrorMessage message={failure.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' variant='outline' disabled={busy || !isDirty}>
					Save draft
				</Button>
				{draft && (
					<Button
						type='button'
						size='sm'
						disabled={busy || isDirty}
						title={isDirty ? 'Save the draft first' : undefined}
						onClick={() => issue.mutate({ id: draft.id, expectedVersion: draft.version })}
					>
						Issue invoice
					</Button>
				)}
			</div>
		</form>
	);
}
