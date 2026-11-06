import {
	DISCOUNT_LABELS,
	OTHER_DISCOUNT_LABELS,
	OTHER_DISCOUNT_TYPES,
	STATUTORY_DISCOUNT_TYPES,
	WITHHOLDING_TAX_RATES,
} from '@loopwise/shared/invoice';
import styles from './billing.module.css';
import type { InvoiceFormValues } from '@/feature/encounters/billing-form-values';
import type { OtherDiscountType, StatutoryDiscountType } from '@loopwise/shared/invoice';
import type { EncounterBillingFieldsFragment } from '@/graphql/generated/graphql';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { identificationOnFile } from '@/feature/encounters/billing-form-values';
import { FormField } from '@/feature/encounters/form-field';

const NONE = 'none';

const isStatutory = (value: string): value is StatutoryDiscountType =>
	(STATUTORY_DISCOUNT_TYPES as readonly string[]).includes(value);
const isOther = (value: string): value is OtherDiscountType =>
	(OTHER_DISCOUNT_TYPES as readonly string[]).includes(value);

/**
 * The invoice's discount and withholding: a senior citizen / PWD discount from the patient's ID on file (RA 9994 /
 * RA 10754), or another discount (employee, promo, special) as a percent or an amount with who approved it; never
 * both. A corporate buyer may withhold tax (BIR 2307).
 */
export function DiscountFields({
	billing,
	values,
	onChange,
	errors,
	disabled,
}: {
	billing: EncounterBillingFieldsFragment;
	values: InvoiceFormValues;
	onChange: (values: InvoiceFormValues) => void;
	errors: (key: string) => string | undefined;
	disabled: boolean;
}) {
	const discount = values.discountType || values.otherDiscountType || NONE;
	const ids = billing.discountIdentifications.filter((id) => id.discountType === values.discountType);
	const approvers = values.otherDiscountType
		? billing.discountApprovers.filter((approver) =>
				approver.types.includes(values.otherDiscountType as OtherDiscountType),
			)
		: [];

	return (
		<div className={styles.fields}>
			<FormField label='Discount'>
				{() => (
					<Select
						value={discount}
						onValueChange={(value) => {
							const statutory = isStatutory(value) ? value : '';
							onChange({
								...values,
								discountType: statutory,
								discountIdentificationId: statutory
									? (identificationOnFile(billing, statutory)?.id ?? '')
									: '',
								discountIdNumber: '',
								otherDiscountType: isOther(value) ? value : '',
								otherDiscountValue: isOther(value) ? values.otherDiscountValue : '',
								otherDiscountApprovedById: '',
							});
						}}
					>
						<SelectTrigger className={styles.control} aria-label='Discount'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={NONE}>None</SelectItem>
							{STATUTORY_DISCOUNT_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{DISCOUNT_LABELS[type]}
								</SelectItem>
							))}
							{OTHER_DISCOUNT_TYPES.map((type) => (
								<SelectItem key={type} value={type}>
									{OTHER_DISCOUNT_LABELS[type]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</FormField>
			{values.discountType &&
				(ids.length > 0 ? (
					<FormField
						label={values.discountType === 'PWD' ? 'PWD ID presented' : 'OSCA ID presented'}
						error={errors('discountIdNumber')}
					>
						{() => (
							<Select
								value={values.discountIdentificationId || undefined}
								onValueChange={(id) => onChange({ ...values, discountIdentificationId: id })}
							>
								<SelectTrigger className={styles.control} aria-label='ID presented'>
									<SelectValue placeholder='Pick the ID shown' />
								</SelectTrigger>
								<SelectContent>
									{ids.map((id) => (
										<SelectItem key={id.id} value={id.id}>
											{/* One string: the select registers its items by their children. */}
											{id.expiresAt ? `${id.idNumber} (until ${id.expiresAt})` : id.idNumber}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</FormField>
				) : (
					<p className={styles.notice} data-testid='discount-id-missing'>
						No {values.discountType === 'PWD' ? 'PWD' : 'senior citizen (OSCA)'} ID on this patient's
						record. Add the ID shown to the patient first.
					</p>
				))}
			{values.otherDiscountType && (
				<>
					<FormField label='Given as'>
						{() => (
							<Select
								value={values.otherDiscountMode}
								onValueChange={(mode) =>
									onChange({ ...values, otherDiscountMode: mode as 'percent' | 'amount' })
								}
							>
								<SelectTrigger className={styles.control} aria-label='Given as'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='percent'>Percent</SelectItem>
									<SelectItem value='amount'>Amount</SelectItem>
								</SelectContent>
							</Select>
						)}
					</FormField>
					<FormField
						label={values.otherDiscountMode === 'percent' ? 'Percent off' : 'Amount off'}
						unit={values.otherDiscountMode === 'percent' ? '%' : '₱'}
						error={errors(
							values.otherDiscountMode === 'percent' ? 'otherDiscountPercent' : 'otherDiscountAmount',
						)}
					>
						{(id) => (
							<Input
								id={id}
								inputMode='decimal'
								value={values.otherDiscountValue}
								onChange={(event) => onChange({ ...values, otherDiscountValue: event.target.value })}
								disabled={disabled}
							/>
						)}
					</FormField>
					<FormField label='Approved by' error={errors('otherDiscountApprovedById')}>
						{() => (
							<Select
								value={values.otherDiscountApprovedById || undefined}
								onValueChange={(userId) => onChange({ ...values, otherDiscountApprovedById: userId })}
							>
								<SelectTrigger className={styles.control} aria-label='Approved by'>
									<SelectValue placeholder='Who approved it' />
								</SelectTrigger>
								<SelectContent>
									{approvers.map((approver) => (
										<SelectItem key={approver.userId} value={approver.userId}>
											{approver.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</FormField>
				</>
			)}
			<FormField label='Withholding tax (BIR 2307)'>
				{() => (
					<Select
						value={values.withholdingTaxRate || '0'}
						onValueChange={(rate) => onChange({ ...values, withholdingTaxRate: rate === '0' ? '' : rate })}
					>
						<SelectTrigger className={styles.control} aria-label='Withholding tax'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{WITHHOLDING_TAX_RATES.map((rate) => (
								<SelectItem key={rate} value={String(rate)}>
									{rate === 0 ? 'None' : `${rate * 100}% (corporate buyer)`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
			</FormField>
		</div>
	);
}
