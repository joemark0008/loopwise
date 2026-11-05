import { Link } from '@tanstack/react-router';
import { FORMULARY } from '@loopwise/shared/formulary';
import {
	allergyWarnings,
	FREQUENCIES,
	MEDICATION_ROUTE_LABELS,
	MEDICATION_ROUTES,
} from '@loopwise/shared/prescription';
import { OctagonAlert, Plus, Printer, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import styles from './encounter.module.css';
import {
	emptyPrescriptionItem,
	itemSig,
	prescriptionFormFrom,
	toSavePrescriptionInput,
	validatePrescriptionForm,
} from './encounter-form-values';
import { formatDateTime, medicineName, quantityLabel } from './encounter-format';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { MedicationRoute } from '@loopwise/shared/prescription';
import type { PrescriptionFormValues, PrescriptionItemFormValues } from './encounter-form-values';
import type { EncounterRecordFieldsFragment, PrescriptionFieldsFragment } from '@/graphql/generated/graphql';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encounterRecordApi } from '@/lib/encounter-record-api';

const formularyLabel = (entry: (typeof FORMULARY)[number]) =>
	`${entry.genericName} ${entry.strength} ${entry.dosageForm}`;

const isDraft = (prescription: PrescriptionFieldsFragment) =>
	prescription.documentStatus === 'DRAFT' && prescription.voidedAt === null;

/** `draft`, `issued` or `voided`, for the status badge. */
const badgeStatus = (prescription: PrescriptionFieldsFragment) =>
	prescription.voidedAt ? 'voided' : prescription.documentStatus.toLowerCase();

/**
 * Prescriptions of the visit. A draft (numbered when first saved) is edited freely; Issue signs it as you, with your
 * PRC license, and locks it: from then on it can only be printed or voided. Generic names come first (RA 6675); items
 * matching a recorded allergy are flagged; a dangerous drug needs the quantities in words and your S2 (RA 9165).
 */
export function PrescriptionsTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [isCreating, setIsCreating] = useState(false);
	const hasDraft = record.prescriptions.some(isDraft);

	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>
				<h3 className={styles.sectionTitle}>Prescriptions</h3>
				{record.canEdit && !isCreating && !hasDraft && (
					<Button size='sm' variant='outline' onClick={() => setIsCreating(true)}>
						<Plus />
						New prescription
					</Button>
				)}
			</div>
			{isCreating && (
				<PrescriptionEditor record={record} prescription={null} onDone={() => setIsCreating(false)} />
			)}
			{record.prescriptions.length === 0 && !isCreating && <Empty>No prescription for this visit.</Empty>}
			{record.prescriptions.map((prescription) =>
				isDraft(prescription) && record.canEdit ? (
					<PrescriptionEditor key={prescription.id} record={record} prescription={prescription} />
				) : (
					<PrescriptionCard key={prescription.id} record={record} prescription={prescription} />
				),
			)}
		</section>
	);
}

function PrescriptionCard({
	record,
	prescription,
}: {
	record: EncounterRecordFieldsFragment;
	prescription: PrescriptionFieldsFragment;
}) {
	const [isVoiding, setIsVoiding] = useState(false);
	const voidPrescription = useRecordMutation(encounterRecordApi.encounterRecord.voidPrescription);

	return (
		<article className={styles.card} data-testid='prescription-card'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					℞ {prescription.rxNo}
					{prescription.isDangerousDrug && <span className={styles.muted}> · S2</span>}
					{prescription.issuedAt && (
						<span className={styles.muted}> · issued {formatDateTime(prescription.issuedAt)}</span>
					)}
				</span>
				<span className={styles.actions}>
					<StatusBadge status={badgeStatus(prescription)} />
					{!prescription.voidedAt && (
						<Button asChild size='sm' variant='outline'>
							<Link
								to='/print/prescription/$prescriptionId'
								params={{ prescriptionId: prescription.id }}
								target='_blank'
							>
								<Printer />
								Print
							</Link>
						</Button>
					)}
					{record.canEdit && !prescription.voidedAt && prescription.documentStatus === 'ISSUED' && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsVoiding(true)}>
							Void
						</Button>
					)}
				</span>
			</div>
			<ol className={styles.rxLines}>
				{prescription.items.map((item) => (
					<li key={item.id}>
						<strong>{medicineName(item)}</strong> — {item.sig} · {quantityLabel(item)}
					</li>
				))}
			</ol>
			{prescription.voidReason && <p className={styles.muted}>Voided: {prescription.voidReason}</p>}
			<VoidDialog
				open={isVoiding}
				onOpenChange={setIsVoiding}
				title='Void prescription'
				description='The prescription stays in the record, marked void. Write a new one if the patient still needs it.'
				isPending={voidPrescription.isPending}
				error={voidPrescription.error?.message}
				onVoid={(reason) =>
					voidPrescription.mutate({ id: prescription.id, reason }, { onSuccess: () => setIsVoiding(false) })
				}
			/>
		</article>
	);
}

function PrescriptionEditor({
	record,
	prescription,
	onDone,
}: {
	record: EncounterRecordFieldsFragment;
	prescription: PrescriptionFieldsFragment | null;
	onDone?: () => void;
}) {
	const [values, setValues] = useState<PrescriptionFormValues>(() => prescriptionFormFrom(prescription));
	const [showErrors, setShowErrors] = useState(false);
	const [override, setOverride] = useState(false);
	const [isDiscarding, setIsDiscarding] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.savePrescription);
	const issue = useRecordMutation(encounterRecordApi.encounterRecord.issuePrescription);
	const discard = useRecordMutation(encounterRecordApi.encounterRecord.voidPrescription);
	const errors = validatePrescriptionForm(values);
	const warnings = allergyWarnings(values.items, record.allergies);
	const isDirty = JSON.stringify(values) !== JSON.stringify(prescriptionFormFrom(prescription));
	const busy = save.isPending || issue.isPending;
	const formularyId = useId();

	const setItem = (index: number, item: PrescriptionItemFormValues) =>
		setValues({ ...values, items: values.items.map((current, i) => (i === index ? item : current)) });

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		setShowErrors(true);
		if (Object.keys(errors).length === 0) {
			save.mutate(toSavePrescriptionInput(record.encounter.id, values), {
				onSuccess: ({ id }) => {
					setValues({ ...values, id });
					setShowErrors(false);
					onDone?.();
				},
			});
		}
	};

	return (
		<form className={styles.card} onSubmit={submit} noValidate data-testid='prescription-editor'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					℞ {prescription ? `${prescription.rxNo} (draft)` : 'New prescription'}
				</span>
				<StatusBadge status='draft' />
			</div>
			<datalist id={formularyId}>
				{FORMULARY.map((entry) => (
					<option key={formularyLabel(entry)} value={formularyLabel(entry)} />
				))}
			</datalist>
			<div className={styles.itemRows}>
				{values.items.map((item, index) => (
					<ItemFields
						key={index}
						index={index}
						item={item}
						errors={showErrors ? errors : {}}
						formularyId={formularyId}
						disabled={busy}
						isDangerousDrug={values.isDangerousDrug}
						onChange={(next) => setItem(index, next)}
						onRemove={
							values.items.length > 1
								? () => setValues({ ...values, items: values.items.filter((_, i) => i !== index) })
								: undefined
						}
					/>
				))}
			</div>
			{showErrors && errors.items && <p className={styles.fieldError}>{errors.items}</p>}
			<label className={styles.checkboxRow}>
				<Checkbox
					checked={values.isDangerousDrug}
					onCheckedChange={(checked) => setValues({ ...values, isDangerousDrug: checked })}
					disabled={busy}
				/>
				Dangerous drug (S2 / yellow Rx, RA 9165): write each quantity in words too
			</label>
			{values.isDangerousDrug && (
				<div className={styles.fields}>
					<FormField label='S2 form serial no. (optional)'>
						{(id) => (
							<Input
								id={id}
								value={values.s2FormSerialNo}
								onChange={(event) => setValues({ ...values, s2FormSerialNo: event.target.value })}
								disabled={busy}
							/>
						)}
					</FormField>
				</div>
			)}
			<div className={styles.actions}>
				<Button
					type='button'
					size='sm'
					variant='ghost'
					onClick={() => setValues({ ...values, items: [...values.items, emptyPrescriptionItem()] })}
				>
					<Plus />
					Add medicine
				</Button>
			</div>
			{warnings.length > 0 && (
				<div className={styles.warning} role='alert'>
					<OctagonAlert className={styles.warningIcon} aria-hidden />
					<strong>Allergy warning:</strong>{' '}
					{warnings.map((warning) => `${warning.genericName} (allergy: ${warning.allergen})`).join(', ')}
					{values.id && (
						<label className={styles.checkboxRow}>
							<Checkbox checked={override} onCheckedChange={setOverride} />I have reviewed it; issue
							anyway
						</label>
					)}
				</div>
			)}
			{save.error && <ErrorMessage message={save.error.message} />}
			{issue.error && <ErrorMessage message={issue.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' variant='outline' disabled={busy || (Boolean(values.id) && !isDirty)}>
					Save draft
				</Button>
				{values.id && (
					<>
						<Button
							type='button'
							size='sm'
							disabled={busy || isDirty || (warnings.length > 0 && !override)}
							title={isDirty ? 'Save the draft first' : undefined}
							onClick={() =>
								values.id && issue.mutate({ id: values.id, overrideAllergyWarning: override })
							}
						>
							Issue prescription
						</Button>
						<Button asChild size='sm' variant='ghost'>
							<Link
								to='/print/prescription/$prescriptionId'
								params={{ prescriptionId: values.id }}
								target='_blank'
							>
								<Printer />
								Preview
							</Link>
						</Button>
						<Button type='button' size='sm' variant='ghost-muted' onClick={() => setIsDiscarding(true)}>
							Discard
						</Button>
					</>
				)}
				{!values.id && onDone && (
					<Button type='button' size='sm' variant='ghost-muted' onClick={onDone}>
						Cancel
					</Button>
				)}
			</div>
			<VoidDialog
				open={isDiscarding}
				onOpenChange={setIsDiscarding}
				title='Discard draft'
				description='The draft is voided; it was never issued.'
				isPending={discard.isPending}
				error={discard.error?.message}
				onVoid={(reason) =>
					values.id && discard.mutate({ id: values.id, reason }, { onSuccess: () => setIsDiscarding(false) })
				}
			/>
		</form>
	);
}

export function ItemFields({
	index,
	item,
	errors,
	formularyId,
	disabled,
	isDangerousDrug = false,
	onChange,
	onRemove,
}: {
	isDangerousDrug?: boolean;
	index: number;
	item: PrescriptionItemFormValues;
	errors: Record<string, string>;
	formularyId: string;
	disabled: boolean;
	onChange: (item: PrescriptionItemFormValues) => void;
	onRemove?: () => void;
}) {
	const error = (field: keyof PrescriptionItemFormValues) => errors[`items.${index}.${field}`];
	type TextField = Exclude<keyof PrescriptionItemFormValues, 'isPrn' | 'route'>;
	const text = (field: TextField, label: string, placeholder?: string, wide?: boolean) => (
		<FormField label={label} error={error(field)} wide={wide}>
			{(id) => (
				<Input
					id={id}
					value={item[field]}
					placeholder={placeholder}
					onChange={(event) => onChange({ ...item, [field]: event.target.value })}
					disabled={disabled}
				/>
			)}
		</FormField>
	);

	return (
		<div className={styles.itemRow} data-testid='prescription-item'>
			<div className={styles.fields}>
				<FormField label='Generic name' error={error('genericName')}>
					{(id) => (
						<Input
							id={id}
							list={formularyId}
							value={item.genericName}
							placeholder='Amlodipine'
							onChange={(event) => {
								const entry = FORMULARY.find((option) => formularyLabel(option) === event.target.value);
								onChange(
									entry
										? {
												...item,
												genericName: entry.genericName,
												strength: entry.strength,
												dosageForm: entry.dosageForm,
											}
										: { ...item, genericName: event.target.value },
								);
							}}
							disabled={disabled}
						/>
					)}
				</FormField>
				{text('brandName', 'Brand (optional)')}
				{text('strength', 'Strength', '5 mg')}
				{text('dosageForm', 'Form', 'tablet')}
				{text('dose', 'Dose', '1 tablet')}
				<FormField label='Frequency' error={error('frequency')}>
					{(id) => (
						<>
							<Input
								id={id}
								list={`${formularyId}-frequency`}
								value={item.frequency}
								placeholder='once a day'
								onChange={(event) => onChange({ ...item, frequency: event.target.value })}
								disabled={disabled}
							/>
							<datalist id={`${formularyId}-frequency`}>
								{FREQUENCIES.map((frequency) => (
									<option key={frequency} value={frequency} />
								))}
							</datalist>
						</>
					)}
				</FormField>
				<FormField label='Route'>
					{() => (
						<Select
							value={item.route}
							onValueChange={(value) => onChange({ ...item, route: value as MedicationRoute })}
						>
							<SelectTrigger className={styles.control} aria-label='Route'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MEDICATION_ROUTES.map((route) => (
									<SelectItem key={route} value={route}>
										{route} — {MEDICATION_ROUTE_LABELS[route]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				{text('durationDays', 'Days')}
				<label className={styles.checkboxRow}>
					<Checkbox
						checked={item.isPrn}
						onCheckedChange={(checked) => onChange({ ...item, isPrn: checked })}
						disabled={disabled}
					/>
					As needed (PRN)
				</label>
				{text('quantity', 'Quantity', '30')}
				{text('unit', 'Unit', 'tablets')}
				{isDangerousDrug && text('quantityInWords', 'Quantity in words', 'thirty (30)')}
				{text('sig', 'Sig (as printed)', itemSig({ ...item, sig: '' }) || '1 tablet by mouth once a day', true)}
			</div>
			{onRemove && (
				<div className={styles.actions}>
					<Button type='button' size='sm' variant='ghost-muted' onClick={onRemove}>
						<Trash2 />
						Remove
					</Button>
				</div>
			)}
		</div>
	);
}
