import {
	CHARGE_KINDS,
	DISCOUNT_KINDS,
	DISCOUNT_LABELS,
	FEE_SCHEDULE,
	formatPesos,
} from '@quarry/shared/encounter-bill';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import { billFormFrom, billFormTotals, emptyCharge, toSaveBillInput, validateBillForm } from './encounter-form-values';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { BillFormValues, ChargeFormValues } from './encounter-form-values';
import type {
	BillDiscountKind,
	ChargeKind,
	EncounterBillFieldsFragment,
	EncounterRecordFieldsFragment,
} from '@/graphql/generated/graphql';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const NO_DISCOUNT = 'none';

/**
 * The bill of the visit: charges (pre-filled with the consultation and the tests ordered), the senior/PWD discount and
 * a PhilHealth package. Finalize locks it; then it is marked paid with the official receipt number, or voided.
 */
export function BillingTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const active = record.bills.find((bill) => bill.status !== 'voided');
	const voided = record.bills.filter((bill) => bill.status === 'voided');

	return (
		<section className={styles.section}>
			<h3 className={styles.sectionTitle}>Bill</h3>
			{active && active.status !== 'draft' ? (
				<BillCard record={record} bill={active} />
			) : record.canEdit ? (
				<BillEditor key={active?.id ?? 'new'} record={record} draftId={active?.id ?? null} />
			) : (
				<Empty>No bill for this visit.</Empty>
			)}
			{voided.map((bill) => (
				<BillCard key={bill.id} record={record} bill={bill} />
			))}
		</section>
	);
}

function Totals({
	subtotal,
	discountKind,
	discountAmount,
	philhealthPackageCode,
	philhealthCoverage,
	total,
}: {
	subtotal: number;
	discountKind: BillDiscountKind | null;
	discountAmount: number;
	philhealthPackageCode: string | null;
	philhealthCoverage: number;
	total: number;
}) {
	return (
		<table className={styles.table} data-testid='bill-totals'>
			<tbody>
				<tr>
					<td>Subtotal</td>
					<td>{formatPesos(subtotal)}</td>
				</tr>
				{discountKind && (
					<tr>
						<td>{DISCOUNT_LABELS[discountKind]}</td>
						<td>−{formatPesos(discountAmount)}</td>
					</tr>
				)}
				{philhealthCoverage > 0 && (
					<tr>
						<td>PhilHealth{philhealthPackageCode && ` (${philhealthPackageCode})`}</td>
						<td>−{formatPesos(philhealthCoverage)}</td>
					</tr>
				)}
				<tr>
					<td>
						<strong>Patient pays</strong>
					</td>
					<td>
						<strong>{formatPesos(total)}</strong>
					</td>
				</tr>
			</tbody>
		</table>
	);
}

function BillCard({ record, bill }: { record: EncounterRecordFieldsFragment; bill: EncounterBillFieldsFragment }) {
	const [isVoiding, setIsVoiding] = useState(false);
	const [orNumber, setOrNumber] = useState('');
	const pay = useRecordMutation(encounterRecordApi.encounterRecord.markBillPaid);
	const voidBill = useRecordMutation(encounterRecordApi.encounterRecord.voidBill);

	return (
		<article className={styles.card} data-testid='bill-card'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					Bill
					{bill.finalizedAt && (
						<span className={styles.muted}> · finalized {formatDateTime(bill.finalizedAt)}</span>
					)}
					{bill.orNumber && <span className={styles.muted}> · OR {bill.orNumber}</span>}
				</span>
				<span className={styles.actions}>
					<StatusBadge status={bill.status} />
					{record.canEdit && bill.status !== 'voided' && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsVoiding(true)}>
							Void
						</Button>
					)}
				</span>
			</div>
			<ChargeTable charges={bill.charges} />
			<Totals {...bill} />
			{bill.voidReason && <p className={styles.muted}>Voided: {bill.voidReason}</p>}
			{record.canEdit && bill.status === 'finalized' && (
				<form
					className={styles.actions}
					onSubmit={(event) => {
						event.preventDefault();
						pay.mutate({ id: bill.id, orNumber });
					}}
				>
					<label htmlFor={`or-${bill.id}`} className={styles.inlineLabel}>
						Official receipt number
					</label>
					<Input
						id={`or-${bill.id}`}
						placeholder='OR-0001234'
						value={orNumber}
						onChange={(event) => setOrNumber(event.target.value)}
						disabled={pay.isPending}
					/>
					<Button type='submit' size='sm' disabled={!orNumber.trim() || pay.isPending}>
						Mark paid
					</Button>
				</form>
			)}
			{pay.error && <ErrorMessage message={pay.error.message} />}
			<VoidDialog
				open={isVoiding}
				onOpenChange={setIsVoiding}
				title='Void bill'
				description='The bill stays in the record, marked void, and a new one can be made.'
				isPending={voidBill.isPending}
				error={voidBill.error?.message}
				onVoid={(reason) => voidBill.mutate({ id: bill.id, reason }, { onSuccess: () => setIsVoiding(false) })}
			/>
		</article>
	);
}

function ChargeTable({ charges }: { charges: EncounterBillFieldsFragment['charges'] }) {
	return (
		<div className={styles.tableScroll} role='region' aria-label='Charges' tabIndex={0}>
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Charge</th>
						<th>Qty</th>
						<th>Price</th>
						<th>Amount</th>
					</tr>
				</thead>
				<tbody>
					{charges.map((charge) => (
						<tr key={charge.id}>
							<td>
								{charge.description}
								{charge.code && <span className={styles.muted}> · {charge.code}</span>}
							</td>
							<td>{charge.quantity}</td>
							<td>{formatPesos(charge.unitPrice)}</td>
							<td>{formatPesos(charge.amount)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function BillEditor({ record, draftId }: { record: EncounterRecordFieldsFragment; draftId: string | null }) {
	const initial = billFormFrom(record);
	const [values, setValues] = useState<BillFormValues>(initial);
	const [showErrors, setShowErrors] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.saveBill);
	const finalize = useRecordMutation(encounterRecordApi.encounterRecord.finalizeBill);
	const errors = validateBillForm(values);
	const totals = billFormTotals(values);
	const isDirty = JSON.stringify(values) !== JSON.stringify(initial) || !draftId;
	const busy = save.isPending || finalize.isPending;
	const error = (key: string) => (showErrors ? errors[key] : undefined);
	const setCharge = (index: number, charge: ChargeFormValues) =>
		setValues({ ...values, charges: values.charges.map((current, i) => (i === index ? charge : current)) });

	return (
		<form
			className={styles.card}
			noValidate
			data-testid='bill-editor'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (Object.keys(errors).length === 0) {
					save.mutate(toSaveBillInput(record.encounter.id, values), {
						onSuccess: () => setShowErrors(false),
					});
				}
			}}
		>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>{draftId ? 'Draft bill' : 'New bill'}</span>
				<StatusBadge status='draft' />
			</div>
			<div className={styles.itemRows}>
				{values.charges.map((charge, index) => (
					<div key={index} className={styles.itemRow} data-testid='bill-charge'>
						<div className={styles.fields}>
							<FormField label='Charge' error={error(`charges.${index}.description`)}>
								{(id) => (
									<Input
										id={id}
										list='fee-schedule'
										value={charge.description}
										onChange={(event) => {
											const fee = FEE_SCHEDULE.find(
												(entry) => entry.description === event.target.value,
											);
											setCharge(
												index,
												fee
													? {
															...charge,
															kind: fee.kind,
															description: fee.description,
															code: fee.code ?? '',
															unitPrice: fee.unitPrice.toString(),
														}
													: { ...charge, description: event.target.value },
											);
										}}
										disabled={busy}
									/>
								)}
							</FormField>
							<FormField label='Kind'>
								{() => (
									<Select
										value={charge.kind}
										onValueChange={(value) =>
											setCharge(index, { ...charge, kind: value as ChargeKind })
										}
									>
										<SelectTrigger className={styles.control} aria-label='Kind'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CHARGE_KINDS.map((kind) => (
												<SelectItem key={kind} value={kind}>
													{kind}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</FormField>
							<FormField label='Quantity' error={error(`charges.${index}.quantity`)}>
								{(id) => (
									<Input
										id={id}
										inputMode='numeric'
										value={charge.quantity}
										onChange={(event) =>
											setCharge(index, { ...charge, quantity: event.target.value })
										}
										disabled={busy}
									/>
								)}
							</FormField>
							<FormField label='Price' unit='₱' error={error(`charges.${index}.unitPrice`)}>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={charge.unitPrice}
										onChange={(event) =>
											setCharge(index, { ...charge, unitPrice: event.target.value })
										}
										disabled={busy}
									/>
								)}
							</FormField>
						</div>
						{values.charges.length > 1 && (
							<div className={styles.actions}>
								<Button
									type='button'
									size='sm'
									variant='ghost-muted'
									onClick={() =>
										setValues({ ...values, charges: values.charges.filter((_, i) => i !== index) })
									}
								>
									<Trash2 />
									Remove
								</Button>
							</div>
						)}
					</div>
				))}
			</div>
			<datalist id='fee-schedule'>
				{FEE_SCHEDULE.map((fee) => (
					<option key={fee.description} value={fee.description} />
				))}
			</datalist>
			{showErrors && errors.charges && <p className={styles.fieldError}>{errors.charges}</p>}
			<div className={styles.actions}>
				<Button
					type='button'
					size='sm'
					variant='ghost'
					onClick={() => setValues({ ...values, charges: [...values.charges, emptyCharge()] })}
				>
					<Plus />
					Add charge
				</Button>
			</div>
			<div className={styles.fields}>
				<FormField label='Discount'>
					{() => (
						<Select
							value={values.discountKind || NO_DISCOUNT}
							onValueChange={(value) =>
								setValues({
									...values,
									discountKind: value === NO_DISCOUNT ? '' : (value as BillDiscountKind),
								})
							}
						>
							<SelectTrigger className={styles.control} aria-label='Discount'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_DISCOUNT}>None</SelectItem>
								{DISCOUNT_KINDS.map((kind) => (
									<SelectItem key={kind} value={kind}>
										{DISCOUNT_LABELS[kind]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='PhilHealth package'>
					{(id) => (
						<Input
							id={id}
							value={values.philhealthPackageCode}
							placeholder='KONSULTA'
							onChange={(event) => setValues({ ...values, philhealthPackageCode: event.target.value })}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='PhilHealth covers' unit='₱' error={error('philhealthCoverage')}>
					{(id) => (
						<Input
							id={id}
							inputMode='decimal'
							value={values.philhealthCoverage}
							onChange={(event) => setValues({ ...values, philhealthCoverage: event.target.value })}
							disabled={busy}
						/>
					)}
				</FormField>
			</div>
			<Totals
				subtotal={totals.subtotal}
				discountKind={values.discountKind || null}
				discountAmount={totals.discountAmount}
				philhealthPackageCode={values.philhealthPackageCode || null}
				philhealthCoverage={totals.philhealthCoverage}
				total={totals.total}
			/>
			{save.error && <ErrorMessage message={save.error.message} />}
			{finalize.error && <ErrorMessage message={finalize.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' variant='outline' disabled={busy || !isDirty}>
					Save draft
				</Button>
				{draftId && (
					<Button
						type='button'
						size='sm'
						disabled={busy || isDirty}
						title={isDirty ? 'Save the draft first' : undefined}
						onClick={() => finalize.mutate({ id: draftId })}
					>
						Finalize bill
					</Button>
				)}
			</div>
		</form>
	);
}
