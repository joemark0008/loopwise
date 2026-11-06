import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { DISPENSE_STATUS } from './dispense-queue-page';
import styles from './pharmacy.module.css';
import { expiresIn, formatDate, numberOrNull, qty } from './pharmacy-format';
import type { DispenseCandidate, DispenseEntry, DispenseItem } from '@/lib/pharmacy-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

const FEFO = '__fefo__';

interface LineDraft {
	include: boolean;
	itemId: string;
	lotId: string;
	quantity: string;
	substitutionReason: string;
}

/** The stock item to start with: the prescribed one with stock, else any with stock, else the first. */
function defaultCandidate(item: DispenseItem): DispenseCandidate | undefined {
	return (
		item.candidates.find((candidate) => candidate.isPrescribed && candidate.usableOnHand > 0) ??
		item.candidates.find((candidate) => candidate.usableOnHand > 0) ??
		item.candidates[0]
	);
}

function draftFor(item: DispenseItem): LineDraft {
	const candidate = defaultCandidate(item);
	const quantity = Math.min(item.remaining, candidate?.usableOnHand ?? 0);
	return {
		include: item.remaining > 0 && quantity > 0,
		itemId: candidate?.itemId ?? '',
		lotId: FEFO,
		quantity: quantity > 0 ? String(quantity) : '',
		substitutionReason: '',
	};
}

/**
 * Dispensing one issued prescription, medicine by medicine: the stock item (the prescribed product, or an equivalent
 * generic of the same strength, recorded as a substitution), the lot (first expiry first out unless one is chosen;
 * expired lots are never offered) and the quantity (part now, the rest later). Generic names come first (RA 6675);
 * dangerous drugs are flagged and need the S2 details on the prescription (RA 9165).
 */
export function DispensePage({ prescriptionId }: { prescriptionId: string }) {
	const entry = useQuery(pharmacyApi.toDispense.queryOptions({ prescriptionId }));
	const [done, setDone] = useState<string | null>(null);
	if (entry.isPending) {
		return <Skeleton />;
	}
	if (entry.error) {
		return <ErrorMessage message={entry.error.message} />;
	}
	const given = entry.data.items.reduce((sum, item) => sum + item.dispensedQty, 0);
	return (
		<DispenseForm key={`${entry.data.prescriptionId}:${given}`} entry={entry.data} done={done} onDone={setDone} />
	);
}

function DispenseForm({
	entry,
	done,
	onDone,
}: {
	entry: DispenseEntry;
	done: string | null;
	onDone: (message: string | null) => void;
}) {
	const queryClient = useQueryClient();
	const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() =>
		Object.fromEntries(entry.items.map((item) => [item.id, draftFor(item)])),
	);
	const dispense = useMutation(
		pharmacyApi.dispense.mutationOptions({
			onSuccess: async (result) => {
				onDone(
					result.status === 'DISPENSED'
						? `${result.rxNo} is fully dispensed.`
						: `Dispensed. ${result.rxNo} still has medicines to give.`,
				);
				await queryClient.invalidateQueries(pharmacyApi.all.pathFilter());
			},
		}),
	);
	const set = (id: string, patch: Partial<LineDraft>) => setDrafts({ ...drafts, [id]: { ...drafts[id], ...patch } });
	const lines = entry.items
		.filter((item) => drafts[item.id]?.include)
		.map((item) => ({ item, draft: drafts[item.id], quantity: numberOrNull(drafts[item.id].quantity) }));
	const valid =
		lines.length > 0 &&
		lines.every(
			({ item, draft, quantity }) =>
				draft.itemId && quantity !== null && quantity > 0 && quantity <= item.remaining,
		);
	const open = entry.status === 'ACTIVE' || entry.status === 'PARTIALLY_DISPENSED';

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (!valid) {
					return;
				}
				onDone(null);
				dispense.mutate({
					prescriptionId: entry.prescriptionId,
					lines: lines.map(({ item, draft, quantity }) => ({
						prescriptionItemId: item.id,
						itemId: draft.itemId,
						lotId: draft.lotId === FEFO ? null : draft.lotId,
						quantity: quantity ?? 0,
						substitutionReason: draft.substitutionReason.trim() || null,
					})),
				});
			}}
		>
			<PageSection title={`${entry.rxNo} · ${entry.patient.name}`}>
				<div className={styles.toolbar}>
					<Link to='/pharmacy/dispense'>Back to the queue</Link>
					<ClinicalFlag tone={DISPENSE_STATUS[entry.status].tone}>
						{DISPENSE_STATUS[entry.status].label}
					</ClinicalFlag>
				</div>
				<dl className={styles.rxHeader}>
					<div>
						<dt>Patient</dt>
						<dd>
							{entry.patient.name} · {entry.patient.patientNo}
						</dd>
					</div>
					<div>
						<dt>Prescriber</dt>
						<dd>{entry.prescriberName ?? '—'}</dd>
					</div>
					<div>
						<dt>Visit</dt>
						<dd>{entry.encounterNo}</dd>
					</div>
					<div>
						<dt>Valid until</dt>
						<dd>{formatDate(entry.validUntil)}</dd>
					</div>
					<div>
						<dt>Allergies</dt>
						<dd>
							{entry.patient.allergies.length > 0 ? (
								<ClinicalFlag tone='critical'>{entry.patient.allergies.join(', ')}</ClinicalFlag>
							) : (
								'None recorded'
							)}
						</dd>
					</div>
					{entry.isDangerousDrug && (
						<div>
							<dt>Dangerous drug (RA 9165)</dt>
							<dd>
								S2 form {entry.s2FormSerialNo ?? '—'} · prescriber S2{' '}
								{entry.prescriberS2LicenseNo ?? '—'}
							</dd>
						</div>
					)}
				</dl>
				{entry.isDangerousDrug && (
					<p className={styles.warning} role='note' data-testid='s2-flag'>
						<ClinicalFlag tone='critical'>Dangerous drug</ClinicalFlag>{' '}
						{entry.s2Missing
							? `Not dispensable yet: the prescription needs ${entry.s2Missing}.`
							: 'Check the yellow S2 form against this prescription and log it in the dangerous drugs book.'}
					</p>
				)}
			</PageSection>
			{entry.items.map((item) => (
				<DispenseLine
					key={item.id}
					item={item}
					draft={drafts[item.id]}
					disabled={!open}
					onChange={(patch) => set(item.id, patch)}
				/>
			))}
			{dispense.error && <ErrorMessage message={dispense.error.message} />}
			{done && (
				<p role='status' className={styles.muted}>
					{done}
				</p>
			)}
			{open && (
				<div className={styles.actions}>
					<Button type='submit' disabled={!valid || dispense.isPending}>
						Dispense {lines.length === 1 ? '1 medicine' : `${lines.length} medicines`}
					</Button>
				</div>
			)}
		</form>
	);
}

function DispenseLine({
	item,
	draft,
	disabled,
	onChange,
}: {
	item: DispenseItem;
	draft: LineDraft;
	disabled: boolean;
	onChange: (patch: Partial<LineDraft>) => void;
}) {
	const candidate = item.candidates.find((option) => option.itemId === draft.itemId);
	const finished = item.remaining <= 0;
	const label = `${item.genericName}${item.strength ? ` ${item.strength}` : ''}`;
	return (
		<section
			className={styles.line}
			data-done={finished || undefined}
			aria-label={label}
			data-testid='dispense-line'
		>
			<div className={styles.lineHead}>
				<div>
					<span className={styles.generic}>{label}</span>
					{item.brandName && <span className={styles.muted}> ({item.brandName})</span>}
					<div className={styles.muted}>
						{item.dosageForm ?? ''} · {item.sig}
					</div>
					{item.isDangerousDrug && (
						<div className={styles.flags}>
							<ClinicalFlag tone='critical'>Dangerous drug (S2)</ClinicalFlag>
							{item.quantityInWords && (
								<span className={styles.muted}>Qty in words: {item.quantityInWords}</span>
							)}
						</div>
					)}
				</div>
				<div className={styles.muted}>
					Prescribed {qty(item.quantity)} {item.unit ?? ''} · given {qty(item.dispensedQty)} · left{' '}
					{qty(item.remaining)}
				</div>
			</div>
			{finished ? (
				<ClinicalFlag tone='done'>Fully dispensed</ClinicalFlag>
			) : item.candidates.length === 0 ? (
				<p className={styles.warning}>
					No stock item of {label} at this clinic. Add the item and receive stock, or give the patient the
					prescription to fill elsewhere.
				</p>
			) : (
				<>
					<label className={styles.checkboxRow}>
						<Checkbox
							checked={draft.include}
							disabled={disabled}
							onCheckedChange={(include) => onChange({ include })}
							aria-label={`Dispense ${label} now`}
						/>
						Dispense now
					</label>
					<div className={styles.lineControls}>
						<Field label='Give'>
							{(id) => (
								<Select
									value={draft.itemId}
									disabled={disabled || !draft.include}
									onValueChange={(itemId) => onChange({ itemId, lotId: FEFO })}
								>
									<SelectTrigger id={id} aria-label={`Stock item for ${label}`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{item.candidates.map((option) => (
											<SelectItem key={option.itemId} value={option.itemId}>
												{option.displayName} — {qty(option.usableOnHand)} {option.unitOfMeasure}
												{option.isPrescribed ? '' : ' (substitute)'}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
						<Field label='Lot'>
							{(id) => (
								<Select
									value={draft.lotId}
									disabled={disabled || !draft.include}
									onValueChange={(lotId) => onChange({ lotId })}
								>
									<SelectTrigger id={id} aria-label={`Lot for ${label}`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={FEFO}>First expiry first out</SelectItem>
										{(candidate?.lots ?? []).map((lot) => (
											<SelectItem key={lot.id} value={lot.id}>
												{lot.lotNo} · {expiresIn(lot.daysToExpiry)} · {qty(lot.quantityOnHand)}{' '}
												left
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
						<Field label='Quantity' hint={`At most ${qty(item.remaining)}`}>
							{(id, describedBy) => (
								<Input
									id={id}
									aria-describedby={describedBy}
									type='number'
									min={0}
									max={item.remaining}
									step='1'
									inputMode='decimal'
									value={draft.quantity}
									disabled={disabled || !draft.include}
									onChange={(event) => onChange({ quantity: event.target.value })}
								/>
							)}
						</Field>
					</div>
					{candidate && !candidate.isPrescribed && draft.include && (
						<Field
							label='Why substitute'
							hint='Recorded with the dispense (RA 6675 allows an equivalent generic).'
						>
							{(id, describedBy) => (
								<Input
									id={id}
									aria-describedby={describedBy}
									value={draft.substitutionReason}
									disabled={disabled}
									onChange={(event) => onChange({ substitutionReason: event.target.value })}
								/>
							)}
						</Field>
					)}
					{candidate && candidate.lots[0] && (
						<p className={styles.muted}>
							First expiry: lot {candidate.lots[0].lotNo}, {formatDate(candidate.lots[0].expiryDate)}
						</p>
					)}
				</>
			)}
		</section>
	);
}
