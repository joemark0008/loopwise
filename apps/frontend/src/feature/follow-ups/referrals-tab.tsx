import { REFERRAL_URGENCIES, ReferralDraftSchema } from '@loopwise/shared/medical-certificate';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { REFERRAL_STATUS } from './referrals-page';
import type { EncounterRecordFieldsFragment, OrderPriority } from '@/graphql/generated/graphql';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import styles from '@/feature/encounters/encounter.module.css';
import { formatDate } from '@/feature/encounters/encounter-format';
import { FormField } from '@/feature/encounters/form-field';
import { useRecordMutation } from '@/feature/encounters/use-record-mutation';
import { VoidDialog } from '@/feature/encounters/void-dialog';
import { DoctorSelect } from '@/feature/scheduling/scheduling-parts';
import { referralApi } from '@/lib/follow-up-api';

type Referral = EncounterRecordFieldsFragment['referrals'][number];

const URGENCY_LABELS: Record<OrderPriority, string> = { ROUTINE: 'Routine', URGENT: 'Urgent', STAT: 'STAT' };

/** Who the referral goes to, as a line. */
function targetOf(referral: Referral): string {
	return (
		referral.toPractitioner?.displayName ??
		([referral.toExternalDoctor, referral.toFacility].filter(Boolean).join(', ') || 'Not named')
	);
}

/**
 * The visit's referrals (DESIGN.md §6): to a doctor of the clinic, who answers in their Referrals inbox, or to an
 * outside doctor or facility, marked from the referring doctor's Sent box. Each prints its letter; one still on its
 * way can be cancelled with a reason.
 */
export function ReferralsTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [isCreating, setIsCreating] = useState(false);
	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>
				<h3 className={styles.sectionTitle}>Referrals</h3>
				{record.canEdit && !isCreating && (
					<Button size='sm' variant='outline' onClick={() => setIsCreating(true)}>
						<Plus />
						Refer
					</Button>
				)}
			</div>
			{isCreating && <ReferralEditor record={record} onDone={() => setIsCreating(false)} />}
			{record.referrals.length === 0 && !isCreating && <Empty>No referral from this visit.</Empty>}
			{record.referrals.map((referral) => (
				<ReferralCard key={referral.id} record={record} referral={referral} />
			))}
		</section>
	);
}

function ReferralCard({ record, referral }: { record: EncounterRecordFieldsFragment; referral: Referral }) {
	const queryClient = useQueryClient();
	const [isCancelling, setIsCancelling] = useState(false);
	const cancel = useRecordMutation(referralApi.cancel);
	const open = referral.status === 'SENT' || referral.status === 'ACCEPTED';
	return (
		<article className={styles.card} data-testid='referral-card'>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>
					To {targetOf(referral)}
					{referral.specialty && <span className={styles.muted}> · {referral.specialty}</span>}
					<span className={styles.muted}> · {formatDate(referral.referredAt)}</span>
				</span>
				<span className={styles.actions}>
					<ClinicalFlag tone={REFERRAL_STATUS[referral.status].tone}>
						{REFERRAL_STATUS[referral.status].label}
					</ClinicalFlag>
					<Button asChild size='sm' variant='outline'>
						<Link to='/print/referral/$referralId' params={{ referralId: referral.id }} target='_blank'>
							<Printer />
							Letter
						</Link>
					</Button>
					{record.canEdit && open && (
						<Button size='sm' variant='ghost-muted' onClick={() => setIsCancelling(true)}>
							Cancel
						</Button>
					)}
				</span>
			</div>
			<p>{referral.reason}</p>
			{referral.urgency !== 'ROUTINE' && <p className={styles.muted}>{URGENCY_LABELS[referral.urgency]}</p>}
			<VoidDialog
				open={isCancelling}
				onOpenChange={setIsCancelling}
				title='Cancel the referral'
				description='The referral stays in the record, marked cancelled.'
				actionLabel='Cancel referral'
				placeholder='Seen here instead'
				isPending={cancel.isPending}
				error={cancel.error?.message}
				onVoid={(reason) =>
					cancel.mutate(
						{ id: referral.id, reason },
						{
							onSuccess: () => {
								setIsCancelling(false);
								void queryClient.invalidateQueries(referralApi.invalidate);
							},
						},
					)
				}
			/>
		</article>
	);
}

/** A new referral from the visit: a doctor of the clinic, or an outside doctor or facility. */
function ReferralEditor({ record, onDone }: { record: EncounterRecordFieldsFragment; onDone: () => void }) {
	const queryClient = useQueryClient();
	const [target, setTarget] = useState<'internal' | 'external'>('internal');
	const [toPractitionerId, setToPractitionerId] = useState('');
	const [toExternalDoctor, setToExternalDoctor] = useState('');
	const [toFacility, setToFacility] = useState('');
	const [specialty, setSpecialty] = useState('');
	const [reason, setReason] = useState('');
	const [clinicalSummary, setClinicalSummary] = useState(
		[record.encounter.reason, record.encounter.assessment].filter(Boolean).join('. '),
	);
	const [urgency, setUrgency] = useState<OrderPriority>('ROUTINE');
	const [showErrors, setShowErrors] = useState(false);
	const create = useRecordMutation(referralApi.create);
	const draft = {
		toPractitionerId: target === 'internal' ? toPractitionerId : undefined,
		toExternalDoctor: target === 'external' ? toExternalDoctor : undefined,
		toFacility: target === 'external' ? toFacility : undefined,
		specialty,
		reason,
		clinicalSummary,
		urgency,
	};
	const parsed = ReferralDraftSchema.safeParse(draft);
	const issues = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);

	return (
		<form
			className={styles.card}
			noValidate
			data-testid='referral-editor'
			onSubmit={(event) => {
				event.preventDefault();
				setShowErrors(true);
				if (!parsed.success) {
					return;
				}
				create.mutate(
					{
						encounterId: record.encounter.id,
						toPractitionerId: parsed.data.toPractitionerId ?? null,
						toExternalDoctor: parsed.data.toExternalDoctor ?? null,
						toFacility: parsed.data.toFacility ?? null,
						specialty: parsed.data.specialty ?? null,
						reason: parsed.data.reason,
						clinicalSummary: parsed.data.clinicalSummary ?? null,
						urgency: parsed.data.urgency,
					},
					{
						onSuccess: () => {
							void queryClient.invalidateQueries(referralApi.invalidate);
							onDone();
						},
					},
				);
			}}
		>
			<div className={styles.cardHeader}>
				<span className={styles.cardTitle}>New referral</span>
			</div>
			<div className={styles.fields}>
				<FormField label='Refer to'>
					{() => (
						<Select value={target} onValueChange={(value) => setTarget(value as 'internal' | 'external')}>
							<SelectTrigger aria-label='Refer to'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='internal'>A doctor of the clinic</SelectItem>
								<SelectItem value='external'>An outside doctor or facility</SelectItem>
							</SelectContent>
						</Select>
					)}
				</FormField>
				{target === 'internal' ? (
					<FormField label='Doctor'>
						{() => (
							<DoctorSelect
								clinicId={record.encounter.clinicId}
								value={toPractitionerId}
								onChange={setToPractitionerId}
							/>
						)}
					</FormField>
				) : (
					<>
						<FormField label='Outside doctor'>
							{(id) => (
								<Input
									id={id}
									value={toExternalDoctor}
									placeholder='Dr. Lorna Pacana'
									onChange={(event) => setToExternalDoctor(event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Facility'>
							{(id) => (
								<Input
									id={id}
									value={toFacility}
									placeholder='Bohol Regional Hospital'
									onChange={(event) => setToFacility(event.target.value)}
								/>
							)}
						</FormField>
					</>
				)}
				<FormField label='Specialty'>
					{(id) => (
						<Input
							id={id}
							value={specialty}
							placeholder='Internal Medicine'
							onChange={(event) => setSpecialty(event.target.value)}
						/>
					)}
				</FormField>
				<FormField label='Urgency'>
					{() => (
						<Select value={urgency} onValueChange={(value) => setUrgency(value as OrderPriority)}>
							<SelectTrigger aria-label='Urgency'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{REFERRAL_URGENCIES.map((value) => (
									<SelectItem key={value} value={value}>
										{URGENCY_LABELS[value]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
				<FormField label='Reason for referral' wide>
					{(id) => (
						<Textarea id={id} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
					)}
				</FormField>
				<FormField label='Clinical summary' wide>
					{(id) => (
						<Textarea
							id={id}
							rows={3}
							value={clinicalSummary}
							onChange={(event) => setClinicalSummary(event.target.value)}
						/>
					)}
				</FormField>
			</div>
			{showErrors && issues.length > 0 && <ErrorMessage message={issues[0]} />}
			{create.error && <ErrorMessage message={create.error.message} />}
			<div className={styles.actionsEnd}>
				<Button type='button' variant='ghost-muted' onClick={onDone}>
					Discard
				</Button>
				<Button type='submit' disabled={create.isPending}>
					Send referral
				</Button>
			</div>
		</form>
	);
}
