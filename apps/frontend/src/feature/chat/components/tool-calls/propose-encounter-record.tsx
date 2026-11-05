import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { allergyWarnings } from '@loopwise/shared/prescription';
import { FileText, Pill } from 'lucide-react';
import { memo, useState } from 'react';
import { diffFields } from './proposal-card/diff-fields';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-encounter-record.module.css';
import type { ProposalConfirm, ProposalTarget } from './proposal-card/proposal-card';
import type { encounterProposal, proposeMedicalCertificate, proposePrescription } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import type { CertificateFormValues, PrescriptionFormValues } from '@/feature/encounters/encounter-form-values';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAgentContext } from '@/contexts/agent.provider';
import {
	emptyPrescriptionItem,
	itemSig,
	newCertificateForm,
	toSaveCertificateInput,
	toSavePrescriptionInput,
	validateCertificateForm,
	validatePrescriptionForm,
} from '@/feature/encounters/encounter-form-values';
import { fitnessLabel, formatDay, medicineName, quantityLabel } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { ItemFields } from '@/feature/encounters/prescriptions-tab';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/*
 * The cards of the encounter-document proposal tools (DESIGN.md §7.1). Each loads the encounter as the clinician
 * (RLS), shows Wise's draft and saves it only on Confirm, with the same mutation as the encounter page and the card's
 * `wiseOrigin`; prescriptions, certificates and bills are saved as drafts, which the clinician issues or finalizes on
 * the encounter page. A draft that replaces one already on the visit is an update card (before → after), saved
 * against the version it showed. The note's card is `propose-encounter-note.tsx`.
 */

type Output = encounterProposal.Output;
const SAVED_ANSWER = /^I saved the /;
const RESOLVED_LABELS = { confirmed: 'Saved as draft', cancelled: 'Not saved' };

/** Settles the tool part, then loads the encounter it names; the card gets the record once it belongs to the patient. */
function ProposalFrame<TInput>({
	toolPart,
	children,
}: {
	toolPart: { state: string; input?: unknown; output?: unknown; errorText?: string };
	children: (input: TInput, output: Output, record: EncounterRecordFieldsFragment) => ReactNode;
}) {
	const output = toolPart.state === 'output-available' ? (toolPart.output as Output | undefined) : undefined;
	const record = useQuery({
		...encounterRecordApi.encounterRecord.get.queryOptions({ encounterId: output?.encounterId ?? '' }),
		enabled: Boolean(output?.encounterId),
	});
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.recordCardSkeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText ?? 'The draft failed.'} />;
	}
	if (!toolPart.input || !output) {
		return null;
	}
	if (record.isPending) {
		return <Skeleton className={styles.recordCardSkeleton} />;
	}
	if (record.error) {
		return <ErrorMessage message={record.error.message} />;
	}
	if (!record.data || record.data.encounter.patientId !== output.patientId) {
		return <ErrorMessage message="Wise named an encounter that isn't this patient's, or that you can't see." />;
	}
	if (!record.data.canEdit) {
		return <ErrorMessage message='Only staff at the facility of the visit can add to its record.' />;
	}
	return children(toolPart.input as TInput, output, record.data);
}

function EncounterLine({ record, tab }: { record: EncounterRecordFieldsFragment; tab: string }) {
	return (
		<p className={styles.recordCardMeta}>
			{record.encounter.reason ?? 'Visit'} · {formatDay(record.encounter.startedAt.slice(0, 10))} ·{' '}
			<Link
				to='/patients/$patientId/encounters/$encounterId'
				params={{ patientId: record.encounter.patientId, encounterId: record.encounter.id }}
				search={{ tab: tab as never }}
				className={styles.recordCardLink}
			>
				Open the encounter
			</Link>
		</p>
	);
}

function Section({ label, text }: { label: string; text: string }) {
	return text ? (
		<div className={styles.recordCardSection}>
			<span className={styles.recordCardLabel}>{label}</span>
			<span className={styles.recordCardText}>{text}</span>
		</div>
	) : null;
}

const firstError = (errors: Record<string, string>) => Object.values(errors)[0];

const isEdited = <T,>(values: T, initial: T) => JSON.stringify(values) !== JSON.stringify(initial);

/** The record an update card changes: the draft already on the visit. */
const replacing = (label: string, record: EncounterRecordFieldsFragment): ProposalTarget => ({
	label,
	detail: `${record.encounter.reason ?? 'Visit'} · ${formatDay(record.encounter.startedAt.slice(0, 10))} · replaces the draft on this visit`,
});

const RX_LABELS = { medicines: 'Medicines', notes: 'Notes' };

/** A prescription as lines of text, for the before → after of an update card (a draft on the visit, or the form). */
const rxSummary = (prescription: {
	notes?: string | null;
	items: {
		genericName: string;
		brandName?: string | null;
		strength?: string | null;
		dosageForm?: string | null;
		sig: string;
		quantity?: number | string | null;
	}[];
}) => ({
	medicines: prescription.items
		.map((item) =>
			[
				medicineName({
					genericName: item.genericName,
					brandName: item.brandName || null,
					strength: item.strength || null,
					dosageForm: item.dosageForm || null,
				}),
				item.sig,
				item.quantity ? `#${item.quantity}` : '',
			]
				.filter(Boolean)
				.join(' — '),
		)
		.join('\n'),
	notes: prescription.notes ?? '',
});

/** The form's items with the sig the API will store. */
const withSigs = (values: PrescriptionFormValues) => ({
	notes: values.notes,
	items: values.items.map((item) => ({ ...item, sig: itemSig(item) })),
});

const CERTIFICATE_LABELS = {
	diagnosis: 'Diagnosis',
	fitness: 'Fitness',
	recommendation: 'Recommendation',
	purpose: 'Purpose',
};

const certificateSummary = (certificate: {
	diagnosisText: string | null;
	isFitToWork: boolean | null;
	restDays?: number | string | null;
	restFrom?: string | null;
	recommendation?: string | null;
	purpose?: string | null;
}) => ({
	diagnosis: certificate.diagnosisText ?? '',
	fitness: [
		fitnessLabel(certificate.isFitToWork),
		certificate.restDays && `rest ${certificate.restDays} day(s) from ${formatDay(certificate.restFrom ?? '')}`,
	]
		.filter(Boolean)
		.join(', '),
	recommendation: certificate.recommendation ?? '',
	purpose: certificate.purpose ?? '',
});

const isFitToWorkOf = (values: CertificateFormValues) => (values.fitness === '' ? null : values.fitness === 'fit');

// ---- propose_prescription ---------------------------------------------------------------------------------------

export const ProposePrescriptionToolCall = memo(({ toolPart }: ToolCallComponentProps<'propose_prescription'>) => (
	<ProposalFrame<proposePrescription.Input> toolPart={toolPart}>
		{(input, _output, record) => (
			<PrescriptionCard toolCallId={toolPart.toolCallId} draft={input} record={record} />
		)}
	</ProposalFrame>
));

function prescriptionFormFromDraft(draft: proposePrescription.Input): PrescriptionFormValues {
	const text = (value?: string) => value ?? '';
	const number = (value?: number) => (value === undefined ? '' : String(value));
	return {
		id: null,
		notes: text(draft.notes),
		isDangerousDrug: draft.isDangerousDrug ?? false,
		s2FormSerialNo: '',
		items: draft.items.map((item) => ({
			...emptyPrescriptionItem(),
			genericName: item.genericName,
			brandName: text(item.brandName),
			strength: text(item.strength),
			dosageForm: text(item.dosageForm),
			dose: item.dose,
			route: item.route ?? 'PO',
			frequency: text(item.frequency),
			durationDays: number(item.durationDays),
			isPrn: item.isPrn ?? false,
			sig: text(item.sig),
			quantity: number(item.quantity),
			unit: text(item.unit),
			quantityInWords: text(item.quantityInWords),
		})),
	};
}

function PrescriptionCard({
	toolCallId,
	draft,
	record,
}: {
	toolCallId: string;
	draft: proposePrescription.Input;
	record: EncounterRecordFieldsFragment;
}) {
	const { queueOrSendMessage } = useAgentContext();
	const existingDraft = record.prescriptions.find(
		(prescription) => prescription.documentStatus === 'DRAFT' && prescription.voidedAt === null,
	);
	const [initial] = useState<PrescriptionFormValues>(() => {
		const drafted = prescriptionFormFromDraft(draft);
		// Replacing a draft keeps its notes unless Wise wrote new ones (a blank means "leave it", never "clear it").
		const notes = draft.notes?.trim() ? draft.notes : (existingDraft?.notes ?? '');
		return { ...drafted, notes, id: existingDraft?.id ?? null };
	});
	const [values, setValues] = useState<PrescriptionFormValues>(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.savePrescription);
	const errors = validatePrescriptionForm(values);
	const warnings = allergyWarnings(values.items, record.allergies);

	const confirm = ({ origin }: ProposalConfirm) => {
		if (firstError(errors)) {
			setIsEditing(true);
			return;
		}
		return save
			.mutateAsync({
				...toSavePrescriptionInput(record.encounter.id, values),
				expectedVersion: existingDraft?.version ?? null,
				wiseOrigin: { ...origin, edited: isEdited(values, initial) },
			})
			.then(
				() =>
					void queueOrSendMessage({
						text: `I saved the prescription draft: ${values.items.map((item) => item.genericName).join(', ')}.`,
					}),
			);
	};

	return (
		<ProposalCard
			{...(existingDraft
				? {
						mode: 'update' as const,
						target: replacing('Draft prescription', record),
						changes: diffFields(rxSummary(existingDraft), rxSummary(withSigs(values)), RX_LABELS),
					}
				: { mode: 'create' as const })}
			toolCallId={toolCallId}
			toolName='propose_prescription'
			icon={Pill}
			title='Prescription'
			testId='propose-prescription'
			confirmLabel='Save draft prescription'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
			warnings={
				warnings.length > 0 && (
					<p className={styles.recordCardWarning} role='alert'>
						Allergy warning:{' '}
						{warnings.map((warning) => `${warning.genericName} (allergy: ${warning.allergen})`).join(', ')}
					</p>
				)
			}
			resolvedLabels={RESOLVED_LABELS}
			isConfirmedAnswer={(answer) => SAVED_ANSWER.test(answer)}
		>
			<div className={styles.recordCardBody}>
				<EncounterLine record={record} tab='prescriptions' />
				{isEditing ? (
					<div className={styles.recordCardFields}>
						{values.items.map((item, index) => (
							<ItemFields
								key={index}
								index={index}
								item={item}
								errors={errors}
								formularyId={`${toolCallId}-formulary`}
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
					</div>
				) : (
					<ol className={styles.recordCardList}>
						{values.items.map((item, index) => (
							<li key={index}>
								<strong>{medicineName({ ...item, brandName: item.brandName || null })}</strong> —{' '}
								{itemSig(item)}
								{item.quantity &&
									` · ${quantityLabel({ quantity: Number(item.quantity), unit: item.unit || null, quantityInWords: item.quantityInWords || null })}`}
							</li>
						))}
					</ol>
				)}
				{firstError(errors) && <p className={styles.recordCardError}>{firstError(errors)}</p>}
			</div>
		</ProposalCard>
	);
}

// ---- propose_medical_certificate --------------------------------------------------------------------------------

export const ProposeMedicalCertificateToolCall = memo(
	({ toolPart }: ToolCallComponentProps<'propose_medical_certificate'>) => (
		<ProposalFrame<proposeMedicalCertificate.Input> toolPart={toolPart}>
			{(input, _output, record) => (
				<CertificateCard toolCallId={toolPart.toolCallId} draft={input} record={record} />
			)}
		</ProposalFrame>
	),
);

function CertificateCard({
	toolCallId,
	draft,
	record,
}: {
	toolCallId: string;
	draft: proposeMedicalCertificate.Input;
	record: EncounterRecordFieldsFragment;
}) {
	const { queueOrSendMessage } = useAgentContext();
	const existingDraft = record.medicalCertificates.find(
		(certificate) => certificate.documentStatus === 'DRAFT' && !certificate.isVoid,
	);
	const [initial] = useState<CertificateFormValues>(() => {
		const base = newCertificateForm(record);
		return {
			...base,
			id: existingDraft?.id ?? null,
			type: draft.type ?? base.type,
			diagnosisText: draft.diagnosisText?.trim() || base.diagnosisText,
			fitness: draft.isFitToWork === undefined ? base.fitness : draft.isFitToWork ? 'fit' : 'unfit',
			restDays: draft.restDays ? String(draft.restDays) : '',
			restFrom: draft.restFrom ?? base.restFrom,
			findings: draft.findings ?? '',
			recommendation: draft.recommendation ?? '',
			purpose: draft.purpose ?? '',
		};
	});
	const [values, setValues] = useState<CertificateFormValues>(initial);
	const [isEditing, setIsEditing] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.saveCertificate);
	const errors = validateCertificateForm(values);
	const set = (key: keyof CertificateFormValues, value: string) => setValues({ ...values, [key]: value });

	const confirm = ({ origin }: ProposalConfirm) => {
		if (firstError(errors)) {
			setIsEditing(true);
			return;
		}
		return save
			.mutateAsync({
				...toSaveCertificateInput(record.encounter.id, values),
				expectedVersion: existingDraft?.version ?? null,
				wiseOrigin: { ...origin, edited: isEdited(values, initial) },
			})
			.then(() => void queueOrSendMessage({ text: 'I saved the medical certificate draft.' }));
	};

	return (
		<ProposalCard
			{...(existingDraft
				? {
						mode: 'update' as const,
						target: replacing('Draft medical certificate', record),
						changes: diffFields(
							certificateSummary(existingDraft),
							certificateSummary({ ...values, isFitToWork: isFitToWorkOf(values) }),
							CERTIFICATE_LABELS,
						),
					}
				: { mode: 'create' as const })}
			toolCallId={toolCallId}
			toolName='propose_medical_certificate'
			icon={FileText}
			title='Medical certificate'
			testId='propose-medical-certificate'
			confirmLabel='Save draft certificate'
			onConfirm={confirm}
			isPending={save.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={save.error?.message}
			resolvedLabels={RESOLVED_LABELS}
			isConfirmedAnswer={(answer) => SAVED_ANSWER.test(answer)}
		>
			<div className={styles.recordCardBody}>
				<EncounterLine record={record} tab='certificate' />
				{isEditing ? (
					<div className={styles.recordCardFields}>
						<FormField label='Diagnosis' error={errors.diagnosisText}>
							{(id) => (
								<Textarea
									id={id}
									rows={2}
									value={values.diagnosisText}
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
						<FormField label='Recommendation'>
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
						<Section label='Diagnosis' text={values.diagnosisText} />
						<Section
							label='Fitness'
							text={[
								fitnessLabel(isFitToWorkOf(values)),
								values.restDays && `rest ${values.restDays} day(s) from ${formatDay(values.restFrom)}`,
							]
								.filter(Boolean)
								.join(', ')}
						/>
						<Section label='Recommendation' text={values.recommendation} />
						<Section label='Purpose' text={values.purpose} />
					</>
				)}
				{firstError(errors) && <p className={styles.recordCardError}>{firstError(errors)}</p>}
			</div>
		</ProposalCard>
	);
}
