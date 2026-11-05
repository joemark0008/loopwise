import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DIAGNOSIS_TYPE_LABELS } from '@loopwise/shared/encounter-record';
import { allergyWarnings } from '@loopwise/shared/prescription';
import { VITAL_FIELDS, VITAL_RANGES } from '@loopwise/shared/vitals';
import { ClipboardList, FileBadge, HeartPulse, Pill, TestTubes } from 'lucide-react';
import { useId, useState } from 'react';
import { ScribePartCard } from './scribe-part-card';
import styles from './scribe.module.css';
import type { ScribePartProps } from './scribe-part-card';
import type { ProposalConfirm } from '@/feature/chat/components/tool-calls/proposal-card/proposal-card';
import type { CertificateFormValues, PrescriptionFormValues } from '@/feature/encounters/encounter-form-values';
import type { OrderPriority } from '@/graphql/generated/graphql';
import { Input } from '@/components/ui/input';
import { isEdited, vitalsForm, vitalsSummary } from '@/feature/chat/components/tool-calls/propose-action';
import {
	CERTIFICATE_LABELS,
	certificateSummary,
	isFitToWorkOf,
	prescriptionFormFromDraft,
	RX_LABELS,
	rxSummary,
	withSigs,
} from '@/feature/chat/components/tool-calls/propose-encounter-record';
import { diffFields } from '@/feature/chat/components/tool-calls/proposal-card/diff-fields';
import {
	newCertificateForm,
	toRecordVitalsInput,
	toSaveCertificateInput,
	toSavePrescriptionInput,
	validateCertificateForm,
	validatePrescriptionForm,
	validateVitalsForm,
} from '@/feature/encounters/encounter-form-values';
import { fitnessLabel, formatDay, medicineName, quantityLabel } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { ItemFields } from '@/feature/encounters/prescriptions-tab';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { PRIORITY_LABELS } from '@/feature/orders/order-format';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { ordersApi } from '@/lib/orders-api';

/*
 * The parts of a scribe draft that add a record to the visit: vitals, a diagnosis, the prescription, the tests and the
 * medical certificate. Each confirms through the same mutation as the encounter page and the single Wise cards, with
 * the scribe card's origin and its part; documents are saved as drafts the doctor issues on the encounter page.
 */

const firstError = (errors: Record<string, string | undefined>) => Object.values(errors).find(Boolean);

/** `vitals`: the measurements said aloud, saved with `recordVitals`. */
export function VitalsCard({ toolCallId, part, draft, record }: ScribePartProps) {
	const [initial] = useState(() => vitalsForm(draft.vitals));
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.recordVitals);
	const errors = validateVitalsForm(values);
	const error = firstError(errors);

	const confirm = ({ origin }: ProposalConfirm) => {
		if (error) {
			setIsEditing(true);
			return;
		}
		return save.mutateAsync({
			...toRecordVitalsInput(record.encounter.id, values),
			wiseOrigin: { ...origin, edited: isEdited(values, initial) },
		});
	};

	return (
		<ScribePartCard
			toolCallId={toolCallId}
			part={part}
			icon={HeartPulse}
			title='Vital signs'
			confirmLabel='Save vitals'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
		>
			<div className={styles.cardBody}>
				{isEditing ? (
					<div className={styles.fields}>
						{VITAL_FIELDS.map((field) => (
							<FormField
								key={field}
								label={VITAL_RANGES[field].label}
								unit={VITAL_RANGES[field].unit}
								error={errors[field]}
							>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={values[field]}
										onChange={(event) => setValues({ ...values, [field]: event.target.value })}
									/>
								)}
							</FormField>
						))}
					</div>
				) : (
					<p className={styles.text}>{vitalsSummary(values) || 'No measurements'}</p>
				)}
				{!isEditing && error && <p className={styles.error}>{error}</p>}
			</div>
		</ScribePartCard>
	);
}

const SCRIBE_DIAGNOSIS_TYPES = ['PRIMARY', 'SECONDARY', 'WORKING'] as const;
type ScribeDiagnosisType = (typeof SCRIBE_DIAGNOSIS_TYPES)[number];

/** `diagnosis-N`: one ICD-10 coded diagnosis, saved with `addDiagnosis`; an unknown code waits for the doctor's. */
export function DiagnosisCard({ toolCallId, part, draft, output, record }: ScribePartProps) {
	const index = Number(part.split('-')[1]);
	const drafted = draft.diagnoses?.[index];
	const checked = output.diagnoses[index];
	const [initial] = useState(() => ({
		icd10Code: checked?.icd10Code ?? drafted?.icd10Code ?? '',
		description: drafted?.description?.trim() || checked?.title || '',
		type: (drafted?.type ?? (index === 0 ? 'PRIMARY' : 'SECONDARY')) as ScribeDiagnosisType,
	}));
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(!checked?.known);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.addDiagnosis);
	const code = values.icd10Code.trim().toUpperCase();
	const onVisit = record.diagnoses.some((diagnosis) => !diagnosis.voidedAt && diagnosis.icd10Code === code);
	const unknown = !checked?.known && code === initial.icd10Code.toUpperCase();

	const confirm = ({ origin }: ProposalConfirm) =>
		save.mutateAsync({
			encounterId: record.encounter.id,
			icd10Code: code,
			description: values.description.trim(),
			type: values.type,
			isFinal: values.type !== 'WORKING',
			wiseOrigin: { ...origin, edited: isEdited(values, initial) },
		});

	return (
		<ScribePartCard
			toolCallId={toolCallId}
			part={part}
			icon={ClipboardList}
			title={code ? `Diagnosis · ${code}` : 'Diagnosis'}
			confirmLabel='Add diagnosis'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			isConfirmDisabled={!code || !values.description.trim() || onVisit || unknown}
			error={save.error?.message}
			warnings={
				onVisit ? (
					<p className={styles.note}>{code} is already on this visit. Dismiss this card.</p>
				) : unknown ? (
					<p className={styles.warning} role='alert'>
						{code} is not in the ICD-10 list. Enter the right code.
					</p>
				) : undefined
			}
		>
			<div className={styles.cardBody}>
				{isEditing ? (
					<div className={styles.fields}>
						<FormField label='ICD-10 code'>
							{(id) => (
								<Input
									id={id}
									value={values.icd10Code}
									onChange={(event) => setValues({ ...values, icd10Code: event.target.value })}
								/>
							)}
						</FormField>
						<FormField label='Diagnosis' wide>
							{(id) => (
								<Input
									id={id}
									value={values.description}
									onChange={(event) => setValues({ ...values, description: event.target.value })}
								/>
							)}
						</FormField>
						<FormField label='Type'>
							{(id) => (
								<select
									id={id}
									className={styles.select}
									value={values.type}
									onChange={(event) =>
										setValues({ ...values, type: event.target.value as ScribeDiagnosisType })
									}
								>
									{SCRIBE_DIAGNOSIS_TYPES.map((type) => (
										<option key={type} value={type}>
											{DIAGNOSIS_TYPE_LABELS[type]}
										</option>
									))}
								</select>
							)}
						</FormField>
					</div>
				) : (
					<p className={styles.text}>
						<strong>{code}</strong> {values.description} · {DIAGNOSIS_TYPE_LABELS[values.type]}
					</p>
				)}
			</div>
		</ScribePartCard>
	);
}

/**
 * `prescription`: the medicines by generic name (RA 6675), with the patient's allergies and a warning on a match; a
 * dangerous drug (RA 9165) needs each quantity in words. Saved as a draft (replacing the visit's draft, at its version).
 */
export function PrescriptionCard({ toolCallId, part, draft, record }: ScribePartProps) {
	const formularyId = useId();
	const existingDraft = record.prescriptions.find(
		(prescription) => prescription.documentStatus === 'DRAFT' && prescription.voidedAt === null,
	);
	const [initial] = useState<PrescriptionFormValues>(() => {
		const drafted = prescriptionFormFromDraft({
			encounterId: record.encounter.id,
			items: draft.prescription?.items ?? [],
			notes: draft.prescription?.notes,
			isDangerousDrug: draft.prescription?.isDangerousDrug,
		});
		const notes = draft.prescription?.notes?.trim() ? drafted.notes : (existingDraft?.notes ?? '');
		return { ...drafted, notes, id: existingDraft?.id ?? null };
	});
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.savePrescription);
	const errors = validatePrescriptionForm(values);
	const error = firstError(errors);
	const warnings = allergyWarnings(values.items, record.allergies);
	const allergies = record.allergies.map(
		(allergy) => `${allergy.allergen}${allergy.severity ? ` (${allergy.severity.toLowerCase()})` : ''}`,
	);

	const confirm = ({ origin }: ProposalConfirm) => {
		if (error) {
			setIsEditing(true);
			return;
		}
		return save.mutateAsync({
			...toSavePrescriptionInput(record.encounter.id, values),
			expectedVersion: existingDraft?.version ?? null,
			wiseOrigin: { ...origin, edited: isEdited(values, initial) },
		});
	};

	return (
		<ScribePartCard
			{...(existingDraft
				? {
						mode: 'update' as const,
						target: { label: 'Draft prescription', detail: 'replaces the draft on this visit' },
						changes: diffFields(rxSummary(existingDraft), rxSummary(withSigs(values)), RX_LABELS),
					}
				: { mode: 'create' as const })}
			toolCallId={toolCallId}
			part={part}
			icon={Pill}
			title={values.isDangerousDrug ? 'Prescription · dangerous drug (S2)' : 'Prescription'}
			confirmLabel='Save draft prescription'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
			warnings={
				<>
					<p className={styles.note} data-testid='scribe-allergies'>
						Allergies: {allergies.length > 0 ? allergies.join(', ') : 'none recorded'}
					</p>
					{warnings.length > 0 && (
						<p className={styles.warning} role='alert'>
							Allergy warning:{' '}
							{warnings
								.map((warning) => `${warning.genericName} (allergy: ${warning.allergen})`)
								.join(', ')}
						</p>
					)}
				</>
			}
		>
			<div className={styles.cardBody}>
				{isEditing ? (
					<>
						{values.items.map((item, index) => (
							<ItemFields
								key={index}
								index={index}
								item={item}
								errors={errors}
								formularyId={formularyId}
								disabled={save.isPending}
								isDangerousDrug={values.isDangerousDrug}
								onChange={(next) =>
									setValues({
										...values,
										items: values.items.map((current, i) => (i === index ? next : current)),
									})
								}
							/>
						))}
					</>
				) : (
					<ol className={styles.list}>
						{withSigs(values).items.map((item, index) => (
							<li key={index}>
								<strong>{medicineName({ ...item, brandName: item.brandName || null })}</strong> —{' '}
								{item.sig}
								{item.quantity &&
									` · ${quantityLabel({ quantity: Number(item.quantity), unit: item.unit || null, quantityInWords: item.quantityInWords || null })}`}
							</li>
						))}
					</ol>
				)}
				{values.notes && <p className={styles.text}>{values.notes}</p>}
				{error && <p className={styles.error}>{error}</p>}
			</div>
		</ScribePartCard>
	);
}

const PRIORITIES: OrderPriority[] = ['ROUTINE', 'URGENT', 'STAT'];

/** `orders`: the tests the API matched to the clinic's catalog, one request for its own lab. */
export function OrdersCard({ toolCallId, part, draft, output, record }: ScribePartProps) {
	const queryClient = useQueryClient();
	const [initial] = useState(() => ({
		priority: (draft.orders?.priority?.toUpperCase() ?? 'ROUTINE') as OrderPriority,
		clinicalInfo: draft.orders?.clinicalInfo ?? '',
	}));
	const [values, setValues] = useState(initial);
	const create = useMutation(
		ordersApi.order.create.mutationOptions({
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries({ queryKey: ['order'] }),
					queryClient.invalidateQueries(encounterRecordApi.encounterRecord.get.pathFilter()),
				]),
		}),
	);
	const { matched, unmatched } = output.tests;

	const confirm = ({ origin }: ProposalConfirm) =>
		create.mutateAsync({
			encounterId: record.encounter.id,
			testIds: matched.map((test) => test.testId),
			priority: values.priority,
			clinicalInfo: values.clinicalInfo.trim() || null,
			wiseOrigin: { ...origin, edited: isEdited(values, initial) },
		});

	return (
		<ScribePartCard
			toolCallId={toolCallId}
			part={part}
			icon={TestTubes}
			title='Lab and imaging'
			confirmLabel={matched.length > 1 ? `Order ${matched.length} tests` : 'Order test'}
			onConfirm={confirm}
			isPending={create.isPending}
			isConfirmDisabled={matched.length === 0}
			error={create.error?.message}
			warnings={
				unmatched.length > 0 && (
					<p className={styles.note}>
						Not in the clinic&apos;s test list, so not ordered here: {unmatched.join(', ')}.
					</p>
				)
			}
		>
			<div className={styles.cardBody}>
				<ul className={styles.list}>
					{matched.map((test) => (
						<li key={test.testId}>
							{test.name} <span className={styles.muted}>{test.code}</span>
						</li>
					))}
				</ul>
				<div className={styles.fields}>
					<FormField label='Priority'>
						{(id) => (
							<select
								id={id}
								className={styles.select}
								value={values.priority}
								onChange={(event) =>
									setValues({ ...values, priority: event.target.value as OrderPriority })
								}
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
								value={values.clinicalInfo}
								onChange={(event) => setValues({ ...values, clinicalInfo: event.target.value })}
							/>
						)}
					</FormField>
				</div>
			</div>
		</ScribePartCard>
	);
}

/** `certificate`: a medical certificate draft (type, fitness, rest days), at the version of a draft it replaces. */
export function CertificateCard({ toolCallId, part, draft, record }: ScribePartProps) {
	const asked = draft.medicalCertificate;
	const existingDraft = record.medicalCertificates.find(
		(certificate) => certificate.documentStatus === 'DRAFT' && !certificate.isVoid,
	);
	const [initial] = useState<CertificateFormValues>(() => {
		const base = newCertificateForm(record);
		return {
			...base,
			id: existingDraft?.id ?? null,
			type: asked?.type ?? base.type,
			// Left empty, the certificate names the visit's diagnoses as they are at Confirm (the cards above add them).
			diagnosisText: asked?.diagnosisText?.trim() ?? '',
			fitness: asked?.isFitToWork === undefined ? base.fitness : asked.isFitToWork ? 'fit' : 'unfit',
			restDays: asked?.restDays ? String(asked.restDays) : '',
			restFrom: asked?.restFrom ?? base.restFrom,
			recommendation: asked?.recommendation ?? '',
			purpose: asked?.purpose ?? '',
		};
	});
	const [values, setValues] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.saveCertificate);
	const certificate = { ...values, diagnosisText: values.diagnosisText || newCertificateForm(record).diagnosisText };
	const errors = validateCertificateForm(certificate);
	const error = firstError(errors);
	const set = (key: keyof CertificateFormValues, value: string) => setValues({ ...values, [key]: value });
	const summary = certificateSummary({ ...certificate, isFitToWork: isFitToWorkOf(certificate) });

	const confirm = ({ origin }: ProposalConfirm) => {
		if (error) {
			setIsEditing(true);
			return;
		}
		return save.mutateAsync({
			...toSaveCertificateInput(record.encounter.id, certificate),
			expectedVersion: existingDraft?.version ?? null,
			wiseOrigin: { ...origin, edited: isEdited(values, initial) },
		});
	};

	return (
		<ScribePartCard
			{...(existingDraft
				? {
						mode: 'update' as const,
						target: { label: 'Draft medical certificate', detail: 'replaces the draft on this visit' },
						changes: diffFields(certificateSummary(existingDraft), summary, CERTIFICATE_LABELS),
					}
				: { mode: 'create' as const })}
			toolCallId={toolCallId}
			part={part}
			icon={FileBadge}
			title='Medical certificate'
			confirmLabel='Save draft certificate'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
			warnings={
				!certificate.diagnosisText && (
					<p className={styles.note}>Confirm the diagnoses above first, or write the diagnosis here.</p>
				)
			}
		>
			<div className={styles.cardBody}>
				{isEditing ? (
					<div className={styles.fields}>
						<FormField label='Diagnosis' error={errors.diagnosisText} wide>
							{(id) => (
								<Input
									id={id}
									value={certificate.diagnosisText}
									onChange={(event) => set('diagnosisText', event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Rest days' error={errors.restDays}>
							{(id) => (
								<Input
									id={id}
									value={values.restDays}
									onChange={(event) => set('restDays', event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Recommendation' wide>
							{(id) => (
								<Input
									id={id}
									value={values.recommendation}
									onChange={(event) => set('recommendation', event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Purpose'>
							{(id) => (
								<Input
									id={id}
									value={values.purpose}
									onChange={(event) => set('purpose', event.target.value)}
								/>
							)}
						</FormField>
					</div>
				) : (
					<>
						{(Object.keys(CERTIFICATE_LABELS) as (keyof typeof CERTIFICATE_LABELS)[]).map(
							(key) =>
								summary[key] && (
									<div key={key} className={styles.section}>
										<span className={styles.sectionLabel}>{CERTIFICATE_LABELS[key]}</span>
										<span className={styles.text}>{summary[key]}</span>
									</div>
								),
						)}
						<p className={styles.muted}>
							{fitnessLabel(isFitToWorkOf(values))}
							{values.restDays && ` · from ${formatDay(values.restFrom)}`}
						</p>
					</>
				)}
				{error && <p className={styles.error}>{error}</p>}
			</div>
		</ScribePartCard>
	);
}
