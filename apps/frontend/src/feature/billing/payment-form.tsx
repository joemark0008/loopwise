import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
	changeDue,
	DESK_PAYMENT_METHODS,
	formatPesos,
	PAYMENT_METHOD_LABELS,
	paymentReferenceLabel,
} from '@loopwise/shared/invoice';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import styles from './billing.module.css';
import type { PaymentFormValues, PaymentTenderFormValues } from '@/feature/encounters/billing-form-values';
import type { PaymentMethod } from '@loopwise/shared/invoice';
import type { InvoiceFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
	emptyTender,
	paymentFormFrom,
	remainingToTender,
	toRecordPaymentsInput,
	validatePaymentForm,
} from '@/feature/encounters/billing-form-values';
import { FormField } from '@/feature/encounters/form-field';
import { billingApi } from '@/lib/billing-api';

/**
 * The cashier's payment on an issued invoice: one tender by default (the whole balance in cash), or several (split
 * tender: part cash, part GCash, a check …). Cash shows the change; e-wallets, cards, transfers and checks need their
 * reference, a check its bank and date. Taken on the cashier's open shift.
 */
export function PaymentForm({ invoice }: { invoice: InvoiceFieldsFragment }) {
	const queryClient = useQueryClient();
	const [values, setValues] = useState<PaymentFormValues>(() => paymentFormFrom(invoice));
	const [showErrors, setShowErrors] = useState(false);
	const pay = useMutation(
		billingApi.billing.recordPayments.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(billingApi.invalidate),
		}),
	);
	const errors = validatePaymentForm(values, invoice.balance);
	const error = (key: string) => (showErrors ? errors[key] : undefined);
	const remaining = remainingToTender(values, invoice.balance);
	const setTender = (index: number, tender: PaymentTenderFormValues) =>
		setValues({ tenders: values.tenders.map((current, i) => (i === index ? tender : current)) });

	return (
		<form
			className={styles.paymentForm}
			noValidate
			data-testid='payment-form'
			aria-label='Payment'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (Object.keys(errors).length === 0) {
					pay.mutate(toRecordPaymentsInput(invoice, values));
				}
			}}
		>
			{values.tenders.map((tender, index) => {
				const key = (field: string) => `tenders.${index}.${field}`;
				const change =
					tender.method === 'CASH'
						? changeDue(Number(tender.amount) || 0, Number(tender.tenderedAmount) || 0)
						: 0;
				return (
					<fieldset key={index} className={styles.tender} data-testid='payment-tender'>
						<legend className={styles.tenderLegend}>
							{values.tenders.length > 1 ? `Tender ${index + 1}` : 'Payment'}
						</legend>
						<div className={styles.fields}>
							<FormField label='Method'>
								{() => (
									<Select
										value={tender.method}
										onValueChange={(method) =>
											setTender(index, { ...tender, method: method as PaymentMethod })
										}
									>
										<SelectTrigger className={styles.control} aria-label={`Method ${index + 1}`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DESK_PAYMENT_METHODS.map((method) => (
												<SelectItem key={method} value={method}>
													{PAYMENT_METHOD_LABELS[method]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
							</FormField>
							<FormField label='Amount' unit='₱' error={error(key('amount'))}>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={tender.amount}
										onChange={(event) =>
											setTender(index, { ...tender, amount: event.target.value })
										}
										disabled={pay.isPending}
									/>
								)}
							</FormField>
							{tender.method === 'CASH' && (
								<FormField label='Cash tendered' unit='₱' error={error(key('tenderedAmount'))}>
									{(id) => (
										<Input
											id={id}
											inputMode='decimal'
											value={tender.tenderedAmount}
											onChange={(event) =>
												setTender(index, { ...tender, tenderedAmount: event.target.value })
											}
											disabled={pay.isPending}
										/>
									)}
								</FormField>
							)}
							<FormField label={paymentReferenceLabel(tender.method)} error={error(key('referenceNo'))}>
								{(id) => (
									<Input
										id={id}
										value={tender.referenceNo}
										onChange={(event) =>
											setTender(index, { ...tender, referenceNo: event.target.value })
										}
										disabled={pay.isPending}
									/>
								)}
							</FormField>
							{tender.method === 'CHECK' && (
								<>
									<FormField label='Bank' error={error(key('bankName'))}>
										{(id) => (
											<Input
												id={id}
												value={tender.bankName}
												onChange={(event) =>
													setTender(index, { ...tender, bankName: event.target.value })
												}
												disabled={pay.isPending}
											/>
										)}
									</FormField>
									<FormField label='Check date' error={error(key('checkDate'))}>
										{(id) => (
											<Input
												id={id}
												type='date'
												value={tender.checkDate}
												onChange={(event) =>
													setTender(index, { ...tender, checkDate: event.target.value })
												}
												disabled={pay.isPending}
											/>
										)}
									</FormField>
								</>
							)}
						</div>
						<div className={styles.tenderFooter}>
							{change > 0 && <span className={styles.muted}>Change {formatPesos(change)}</span>}
							{values.tenders.length > 1 && (
								<Button
									type='button'
									size='sm'
									variant='ghost-muted'
									onClick={() => setValues({ tenders: values.tenders.filter((_, i) => i !== index) })}
								>
									<Trash2 />
									Remove tender
								</Button>
							)}
						</div>
					</fieldset>
				);
			})}
			{showErrors && (errors.total || errors._) && (
				<p className={styles.fieldError}>{errors.total ?? errors._}</p>
			)}
			<div className={styles.actions}>
				<span className={styles.muted} data-testid='payment-remaining'>
					Balance {formatPesos(invoice.balance)}
					{remaining > 0 && remaining !== invoice.balance
						? ` · ${formatPesos(remaining)} left to tender`
						: ''}
				</span>
				{values.tenders.length < 6 && (
					<Button
						type='button'
						size='sm'
						variant='ghost'
						onClick={() =>
							setValues({
								tenders: [
									...values.tenders,
									emptyTender('GCASH', remaining > 0 ? String(remaining) : ''),
								],
							})
						}
					>
						<Plus />
						Split tender
					</Button>
				)}
				<Button type='submit' size='sm' disabled={pay.isPending}>
					Record payment
				</Button>
			</div>
			{pay.error && <ErrorMessage message={pay.error.message} />}
		</form>
	);
}
