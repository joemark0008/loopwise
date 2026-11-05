import { Link } from '@tanstack/react-router';
import { CERTIFICATE_TYPE_LABELS, CERTIFICATE_TYPES } from '@loopwise/shared/medical-certificate';
import { Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import styles from './encounter.module.css';
import {
	certificateFormFrom,
	newCertificateForm,
	toSaveCertificateInput,
	validateCertificateForm,
} from './encounter-form-values';
import { certificateTypeLabel, fitnessLabel, formatDateTime, formatDay } from './encounter-format';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { CertificateType } from '@loopwise/shared/medical-certificate';
import type { CertificateFormValues, FitnessValue } from './encounter-form-values';
import type { EncounterRecordFieldsFragment, MedicalCertificateFieldsFragment } from '@/graphql/generated/graphql';
import { StatusBadge } from '@/components/clinical/status-badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { encounterRecordApi } from '@/lib/encounter-record-api';

type Certificate = MedicalCertificateFieldsFragment;

const isDraft = (certificate: Certificate) => certificate.documentStatus === 'DRAFT' && !certificate.isVoid;

/** `draft`, `issued` or `voided`, for the status badge. */
const badgeStatus = (certificate: Certificate) =>
	certificate.isVoid ? 'voided' : certificate.documentStatus.toLowerCase();

const FITNESS_OPTIONS: { value: FitnessValue | 'none'; label: string }[] = [
	{ value: 'fit', label: 'Fit to work' },
	{ value: 'unfit', label: 'Unfit to work' },
	{ value: 'none', label: 'Not stated' },
];

/**
 * Medical certificates from the visit: pre-filled from its diagnoses, numbered when first saved, issued (signed,
 * locked) as you with your PRC license, printed with a verification code.
 */
export function CertificateTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [isCreating, setIsCreating] = useState(false);
	const hasDraft = record.medicalCertificates.some(isDraft);

	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>
				<h3 className={styles.sectionTitle}>Medical certificates</h3>
				{record.canEdit && !isCreating && !hasDraft && (
					<Button size='sm' variant='outline' onClick={() => setIsCreating(true)}>
						<Plus />
						New certificate
					</Button>
				)}
			</div>
			{isCreating && (
				<CertificateEditor
					record={record}
					initial={newCertificateForm(record)}
					onDone={() => setIsCreating(false)}
				/>
			)}
			{record.medicalCertificates.length === 0 && !isCreating && <Empty>No certificate for this visit.</Empty>}
			{record.medicalCertificates.map((certificate) =>
				isDraft(certificate) && record.canEdit ? (
					<CertificateEditor
						key={certificate.id}
						record={record}
						initial={certificateFormFrom(certificate)}
					/>
				) : (
					<CertificateCard key={certificate.id} record={record} certificate={certificate} />
				),
			)}
		</section>
	);
}

function restText(certificate: { restFrom: string | null; restTo: string | null; restDays: number | null }) {
	if (!certificate.restFrom || !certificate.restDays || !certificate.restTo) {
		return null;
	}
	return `Rest ${certificate.restDays} day${certificate.restDays === 1 ? '' : 's'}, ${formatDay(certificate.restFrom)} to ${formatDay(certificate.restTo)}`;
}

function CertificateCard({ record, certificate }: { record: EncounterRecordFieldsFragment; certificate: Certificate }) {
	const [isVoiding, setIsVoiding] = useState(false);
	const voidCertificate = useRecordMutation(encounterRecordApi.encounterRecord.voidCertificate);
	const rest = restText(certificate);

	return (
		<article className={styles.card} data-testid='certificate-card'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					{certificate.certNo} · {certificateTypeLabel(certificate.type)}
					{certificate.issuedAt && (
						<span className={styles.muted}> · issued {formatDateTime(certificate.issuedAt)}</span>
					)}
				</span>
				<span className={styles.actions}>
					<StatusBadge status={badgeStatus(certificate)} />
					{!certificate.isVoid && (
						<Button asChild size='sm' variant='outline'>
							<Link
								to='/print/medical-certificate/$certificateId'
								params={{ certificateId: certificate.id }}
								target='_blank'
							>
								<Printer />
								Print
							</Link>
						</Button>
					)}
					{record.canEdit && !certificate.isVoid && certificate.documentStatus === 'ISSUED' && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsVoiding(true)}>
							Void
						</Button>
					)}
				</span>
			</div>
			<p>{certificate.diagnosisText}</p>
			<p className={styles.muted}>
				{[fitnessLabel(certificate.isFitToWork), rest].filter(Boolean).join(' · ')}
				{certificate.purpose && ` · for ${certificate.purpose}`}
			</p>
			{certificate.voidReason && <p className={styles.muted}>Voided: {certificate.voidReason}</p>}
			<VoidDialog
				open={isVoiding}
				onOpenChange={setIsVoiding}
				title='Void certificate'
				description='The certificate stays in the record, marked void.'
				isPending={voidCertificate.isPending}
				error={voidCertificate.error?.message}
				onVoid={(reason) =>
					voidCertificate.mutate({ id: certificate.id, reason }, { onSuccess: () => setIsVoiding(false) })
				}
			/>
		</article>
	);
}

function CertificateEditor({
	record,
	initial,
	onDone,
}: {
	record: EncounterRecordFieldsFragment;
	initial: CertificateFormValues;
	onDone?: () => void;
}) {
	const [values, setValues] = useState(initial);
	const [showErrors, setShowErrors] = useState(false);
	const [isDiscarding, setIsDiscarding] = useState(false);
	const save = useRecordMutation(encounterRecordApi.encounterRecord.saveCertificate);
	const issue = useRecordMutation(encounterRecordApi.encounterRecord.issueCertificate);
	const discard = useRecordMutation(encounterRecordApi.encounterRecord.voidCertificate);
	const errors = validateCertificateForm(values);
	const isDirty = JSON.stringify(values) !== JSON.stringify(initial);
	const busy = save.isPending || issue.isPending;
	const set = <K extends keyof CertificateFormValues>(key: K, value: CertificateFormValues[K]) =>
		setValues({ ...values, [key]: value });
	const error = (key: string) => (showErrors ? errors[key] : undefined);

	return (
		<form
			className={styles.card}
			noValidate
			data-testid='certificate-editor'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (Object.keys(errors).length === 0) {
					save.mutate(toSaveCertificateInput(record.encounter.id, values), {
						onSuccess: ({ id }) => {
							setValues({ ...values, id });
							setShowErrors(false);
							onDone?.();
						},
					});
				}
			}}
		>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>{values.id ? 'Draft certificate' : 'New certificate'}</span>
				<StatusBadge status='draft' />
			</div>
			<div className={styles.fields}>
				<FormField label='Examined on' error={error('examinedOn')}>
					{(id) => (
						<Input
							id={id}
							type='date'
							value={values.examinedOn}
							onChange={(event) => set('examinedOn', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Type'>
					{() => (
						<Select value={values.type} onValueChange={(value) => set('type', value as CertificateType)}>
							<SelectTrigger className={styles.control} aria-label='Type'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CERTIFICATE_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{CERTIFICATE_TYPE_LABELS[type]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='Fitness'>
					{() => (
						<Select
							value={values.fitness || 'none'}
							onValueChange={(value) => set('fitness', value === 'none' ? '' : (value as FitnessValue))}
						>
							<SelectTrigger className={styles.control} aria-label='Fitness'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FITNESS_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='Rest days' error={error('restDays')}>
					{(id) => (
						<Input
							id={id}
							inputMode='numeric'
							value={values.restDays}
							onChange={(event) => set('restDays', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Rest from' error={error('restFrom')}>
					{(id) => (
						<Input
							id={id}
							type='date'
							value={values.restFrom}
							onChange={(event) => set('restFrom', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Diagnosis' error={error('diagnosisText')} wide>
					{(id) => (
						<Textarea
							id={id}
							rows={2}
							value={values.diagnosisText}
							onChange={(event) => set('diagnosisText', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Findings' error={error('findings')} wide>
					{(id) => (
						<Textarea
							id={id}
							rows={2}
							value={values.findings}
							onChange={(event) => set('findings', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Recommendation' error={error('recommendation')} wide>
					{(id) => (
						<Textarea
							id={id}
							rows={2}
							value={values.recommendation}
							placeholder='e.g. May return to light duty; avoid heavy lifting'
							onChange={(event) => set('recommendation', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
				<FormField label='Purpose' error={error('purpose')}>
					{(id) => (
						<Input
							id={id}
							value={values.purpose}
							placeholder='work, school'
							onChange={(event) => set('purpose', event.target.value)}
							disabled={busy}
						/>
					)}
				</FormField>
			</div>
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
							disabled={busy || isDirty}
							title={isDirty ? 'Save the draft first' : undefined}
							onClick={() => values.id && issue.mutate({ id: values.id })}
						>
							Issue certificate
						</Button>
						<Button asChild size='sm' variant='ghost'>
							<Link
								to='/print/medical-certificate/$certificateId'
								params={{ certificateId: values.id }}
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
