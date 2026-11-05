import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	changeDue,
	DISCOUNT_LABELS,
	formatPesos,
	INVOICE_STATUS_LABELS,
	PAYMENT_METHOD_LABELS,
	PAYMENT_METHODS,
	paymentReferenceLabel,
	STATUTORY_DISCOUNT_TYPES,
	TAX_TYPE_LABELS,
} from '@loopwise/shared/invoice';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import {
	activeInvoice,
	emptyInvoiceLine,
	idNumberOnFile,
	invoiceFormFrom,
	invoiceFormTotals,
	lineFromPriceItem,
	paymentFormFrom,
	toRecordPaymentInput,
	toSaveInvoiceDraftInput,
	validateInvoiceForm,
	validatePaymentForm,
} from './billing-form-values';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { VoidDialog } from './void-dialog';
import type { InvoiceFormValues, InvoiceLineFormValues, PaymentFormValues } from './billing-form-values';
import type { PaymentMethod, StatutoryDiscountType } from '@loopwise/shared/invoice';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { billingApi } from '@/lib/billing-api';

const NO_DISCOUNT = 'none';

/** The badge of an invoice status (the shared badge speaks lower case). */
const badgeStatus = (status: InvoiceFieldsFragment['status']) => (status === 'VOID' ? 'voided' : status.toLowerCase());

/** A billing write: on success the visit's billing is read again. */
function useBillingMutation<TInput, TOutput>(procedure: {
	mutationOptions: (
		opts?: Omit<UseMutationOptions<TOutput, Error, TInput>, 'mutationFn' | 'mutationKey'>,
	) => UseMutationOptions<TOutput, Error, TInput>;
}) {
	const queryClient = useQueryClient();
	return useMutation(
		procedure.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(billingApi.billing.get.pathFilter()),
		}),
	);
}

/**
 * The visit's invoice (BIR sales invoice): the doctor or the desk drafts it from the clinic's price list (the
 * consultation and the tests ordered to start), with the senior citizen / PWD discount and the ID shown; issuing
 * numbers and locks it; the cashier then records payments (a PhilHealth package such as Konsulta is a PhilHealth
 * payment) until it is paid, or voids it with a reason.
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
				<InvoiceEditor key={active?.id ?? 'new'} billing={data} draft={active} />
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

/** The BIR breakdown: VATable / VAT-exempt / zero-rated sales, VAT, the SC/PWD discount and the amount due. */
export function InvoiceTotals({
	totals,
	discountType,
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
		netAmount: number;
	};
	discountType: StatutoryDiscountType | null;
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

/** An issued, paid or voided invoice (or a draft, read-only, for staff who don't bill). */
function InvoiceCard({
	billing,
	invoice,
}: {
	billing: EncounterBillingFieldsFragment;
	invoice: InvoiceFieldsFragment;
}) {
	const [isVoiding, setIsVoiding] = useState(false);
	const voidInvoice = useBillingMutation(billingApi.billing.void);
	const discount = invoice.discounts[0];
	const discountType =
		discount && (discount.type === 'SENIOR_CITIZEN' || discount.type === 'PWD') ? discount.type : null;
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
					{billing.canCollect && invoice.status !== 'VOID' && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsVoiding(true)}>
							Void
						</Button>
					)}
				</span>
			</div>
			<p className={styles.muted}>Sold to {invoice.buyerName}</p>
			<InvoiceLines lines={invoice.lines} />
			{discount && (
				<p className={styles.muted} data-testid='invoice-discount'>
					{discountType ? DISCOUNT_LABELS[discountType] : discount.type} · ID{' '}
					{discount.idNumber ?? 'not recorded'}
					{discount.identificationId ? ' (on file)' : ''}
				</p>
			)}
			<InvoiceTotals
				totals={invoice}
				discountType={discountType}
				payments={invoice.status === 'DRAFT' ? undefined : invoice}
			/>
			{invoice.payments.length > 0 && <PaymentList payments={invoice.payments} />}
			{invoice.voidReason && <p className={styles.muted}>Voided: {invoice.voidReason}</p>}
			{billing.canCollect && payable && <PaymentForm key={invoice.version} invoice={invoice} />}
			<VoidDialog
				open={isVoiding}
				onOpenChange={setIsVoiding}
				title='Void invoice'
				description='The invoice stays in the record, marked void, with its payments; a new one can then be drafted.'
				isPending={voidInvoice.isPending}
				error={voidInvoice.error?.message}
				onVoid={(reason) =>
					voidInvoice.mutate(
						{ id: invoice.id, reason, expectedVersion: invoice.version },
						{ onSuccess: () => setIsVoiding(false) },
					)
				}
			/>
		</article>
	);
}

function PaymentList({ payments }: { payments: InvoiceFieldsFragment['payments'] }) {
	return (
		<ul className={styles.muted} data-testid='invoice-payments'>
			{payments.map((payment) => (
				<li key={payment.id}>
					{PAYMENT_METHOD_LABELS[payment.method]} {formatPesos(payment.amount)}
					{payment.referenceNo && ` · ${payment.referenceNo}`}
					{payment.changeAmount ? ` · change ${formatPesos(payment.changeAmount)}` : ''} · {payment.paymentNo}
					{payment.status !== 'POSTED' && ` · ${payment.status.toLowerCase()}`}
				</li>
			))}
		</ul>
	);
}

/** The cashier's payment: method, amount (the balance by default), cash tendered and the OR / reference number. */
function PaymentForm({ invoice }: { invoice: InvoiceFieldsFragment }) {
	const [values, setValues] = useState<PaymentFormValues>(() => paymentFormFrom(invoice));
	const [showErrors, setShowErrors] = useState(false);
	const pay = useBillingMutation(billingApi.billing.recordPayment);
	const errors = validatePaymentForm(values, invoice.balance);
	const error = (key: string) => (showErrors ? errors[key] : undefined);
	const isCash = values.method === 'CASH';
	const change = isCash ? changeDue(Number(values.amount) || 0, Number(values.tenderedAmount) || 0) : 0;

	return (
		<form
			className={styles.fields}
			noValidate
			data-testid='payment-form'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (Object.keys(errors).length === 0) {
					pay.mutate(toRecordPaymentInput(invoice, values));
				}
			}}
		>
			<FormField label='Method'>
				{() => (
					<Select
						value={values.method}
						onValueChange={(method) => setValues({ ...values, method: method as PaymentMethod })}
					>
						<SelectTrigger className={styles.control} aria-label='Method'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAYMENT_METHODS.map((method) => (
								<SelectItem key={method} value={method}>
									{PAYMENT_METHOD_LABELS[method]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</FormField>
			<FormField label='Amount' unit='₱' error={error('amount')}>
				{(id) => (
					<Input
						id={id}
						inputMode='decimal'
						value={values.amount}
						onChange={(event) => setValues({ ...values, amount: event.target.value })}
						disabled={pay.isPending}
					/>
				)}
			</FormField>
			{isCash && (
				<FormField label='Cash tendered' unit='₱' error={error('tenderedAmount')}>
					{(id) => (
						<Input
							id={id}
							inputMode='decimal'
							value={values.tenderedAmount}
							onChange={(event) => setValues({ ...values, tenderedAmount: event.target.value })}
							disabled={pay.isPending}
						/>
					)}
				</FormField>
			)}
			<FormField label={paymentReferenceLabel(values.method)} error={error('referenceNo')}>
				{(id) => (
					<Input
						id={id}
						value={values.referenceNo}
						onChange={(event) => setValues({ ...values, referenceNo: event.target.value })}
						disabled={pay.isPending}
					/>
				)}
			</FormField>
			<div className={styles.actions}>
				{change > 0 && <span className={styles.muted}>Change {formatPesos(change)}</span>}
				<Button type='submit' size='sm' disabled={pay.isPending}>
					Record payment
				</Button>
			</div>
			{pay.error && <ErrorMessage message={pay.error.message} />}
		</form>
	);
}

/** The draft: lines from the price list or free text, the SC/PWD discount, then save and issue. */
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
	const issue = useBillingMutation(billingApi.billing.issue);
	const errors = validateInvoiceForm(values);
	const totals = invoiceFormTotals(values);
	const isDirty = JSON.stringify(values) !== JSON.stringify(initial) || !draft;
	const busy = save.isPending || issue.isPending;
	const error = (key: string) => (showErrors ? errors[key] : undefined);
	const setLine = (index: number, line: InvoiceLineFormValues) =>
		setValues({ ...values, lines: values.lines.map((current, i) => (i === index ? line : current)) });

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
				<StatusBadge status='draft' />
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
													: { ...line, serviceItemId: '', description: event.target.value },
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
								{line.serviceItemId ? TAX_TYPE_LABELS[line.taxType] : 'Not on the price list'} ·{' '}
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
			<div className={styles.fields}>
				<FormField label='Discount'>
					{() => (
						<Select
							value={values.discountType || NO_DISCOUNT}
							onValueChange={(value) => {
								const discountType = value === NO_DISCOUNT ? '' : (value as StatutoryDiscountType);
								setValues({
									...values,
									discountType,
									discountIdNumber: values.discountIdNumber || idNumberOnFile(billing, discountType),
								});
							}}
						>
							<SelectTrigger className={styles.control} aria-label='Discount'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_DISCOUNT}>None</SelectItem>
								{STATUTORY_DISCOUNT_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{DISCOUNT_LABELS[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				{values.discountType && (
					<FormField
						label={values.discountType === 'PWD' ? 'PWD ID number' : 'OSCA ID number'}
						error={error('discountIdNumber')}
					>
						{(id) => (
							<Input
								id={id}
								value={values.discountIdNumber}
								onChange={(event) => setValues({ ...values, discountIdNumber: event.target.value })}
								disabled={busy}
							/>
						)}
					</FormField>
				)}
			</div>
			<InvoiceTotals totals={totals} discountType={values.discountType || null} />
			<p className={styles.muted}>
				PhilHealth package coverage (e.g. Konsulta) is recorded as a PhilHealth payment once the invoice is
				issued.
			</p>
			{save.error && <ErrorMessage message={save.error.message} />}
			{issue.error && <ErrorMessage message={issue.error.message} />}
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
