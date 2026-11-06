import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './pharmacy.module.css';
import { numberOrNull, orNull, qty } from './pharmacy-format';
import { PageSection } from '@/components/clinical/page-header';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

/**
 * Pharmacy → Supplies used: supplies used on a visit (a dressing, the lab's tubes), by the visit number. Taken first
 * expiry first out and written as CONSUMPTION rows of the ledger, linked to the visit.
 */
export function ConsumptionPage() {
	const queryClient = useQueryClient();
	const items = useQuery(pharmacyApi.items.queryOptions({}));
	const [encounterNo, setEncounterNo] = useState('');
	const [itemId, setItemId] = useState('');
	const [quantity, setQuantity] = useState('');
	const [reason, setReason] = useState('');
	const [done, setDone] = useState<string | null>(null);
	const record = useMutation(
		pharmacyApi.recordConsumption.mutationOptions({
			onSuccess: async (rows) => {
				const total = rows.reduce((sum, row) => sum - row.quantity, 0);
				setDone(`Recorded ${qty(total)} of ${rows[0]?.itemName ?? 'the item'} on ${encounterNo.trim()}.`);
				setQuantity('');
				await queryClient.invalidateQueries(pharmacyApi.all.pathFilter());
			},
		}),
	);
	const amount = numberOrNull(quantity);
	const valid = encounterNo.trim() && itemId && amount !== null && amount > 0;
	const selected = items.data?.find((item) => item.id === itemId);

	return (
		<PageSection title='Supplies used on a visit'>
			<form
				className={styles.form}
				onSubmit={(event) => {
					event.preventDefault();
					if (!valid || amount === null) {
						return;
					}
					setDone(null);
					record.mutate({
						encounterNo: encounterNo.trim(),
						reason: orNull(reason),
						lines: [{ itemId, quantity: amount }],
					});
				}}
			>
				<div className={styles.fields}>
					<Field label='Visit no.' required hint='As printed on the visit, e.g. TAG-ENC-2026-000012.'>
						{(id, describedBy) => (
							<Input
								id={id}
								aria-describedby={describedBy}
								value={encounterNo}
								onChange={(event) => setEncounterNo(event.target.value)}
								required
							/>
						)}
					</Field>
					<Field label='Supply' required>
						{(id) => (
							<Select value={itemId} onValueChange={setItemId}>
								<SelectTrigger id={id} aria-label='Supply'>
									<SelectValue placeholder='Choose the supply' />
								</SelectTrigger>
								<SelectContent>
									{(items.data ?? []).map((item) => (
										<SelectItem key={item.id} value={item.id}>
											{item.displayName} — {qty(item.usableOnHand)} {item.unitOfMeasure}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</Field>
					<Field label='Quantity' required hint={selected ? `In ${selected.unitOfMeasure}` : undefined}>
						{(id, describedBy) => (
							<Input
								id={id}
								aria-describedby={describedBy}
								type='number'
								min={0}
								step='1'
								inputMode='decimal'
								value={quantity}
								onChange={(event) => setQuantity(event.target.value)}
								required
							/>
						)}
					</Field>
					<Field label='Used for'>
						{(id) => (
							<Input
								id={id}
								value={reason}
								placeholder='e.g. Wound dressing'
								onChange={(event) => setReason(event.target.value)}
							/>
						)}
					</Field>
				</div>
				{record.error && <ErrorMessage message={record.error.message} />}
				{done && (
					<p role='status' className={styles.muted}>
						{done}
					</p>
				)}
				<div className={styles.actions}>
					<Button type='submit' size='sm' disabled={!valid || record.isPending}>
						Record supplies used
					</Button>
				</div>
			</form>
		</PageSection>
	);
}
