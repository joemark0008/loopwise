import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './pharmacy.module.css';
import { numberOrNull, qty } from './pharmacy-format';
import type { InventoryLot } from '@/lib/pharmacy-api';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

export type StockAction = 'adjust' | 'dispose' | 'damaged';

const TITLES: Record<StockAction, string> = {
	adjust: 'Adjust the count',
	dispose: 'Dispose of expired stock',
	damaged: 'Write off damaged stock',
};

/** One explicit stock change of a lot: a count adjustment, an expired disposal or damage, always with the reason. */
export function StockActionDialog({
	action,
	onClose,
}: {
	action: { kind: StockAction; lot: InventoryLot } | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				{action && <StockActionForm key={`${action.kind}:${action.lot.id}`} {...action} onDone={onClose} />}
			</DialogContent>
		</Dialog>
	);
}

function StockActionForm({ kind, lot, onDone }: { kind: StockAction; lot: InventoryLot; onDone: () => void }) {
	const queryClient = useQueryClient();
	const [direction, setDirection] = useState<'IN' | 'OUT'>('OUT');
	const [quantity, setQuantity] = useState(kind === 'dispose' ? String(lot.quantityOnHand) : '');
	const [reason, setReason] = useState('');
	const onSuccess = async () => {
		await queryClient.invalidateQueries(pharmacyApi.all.pathFilter());
		onDone();
	};
	const adjust = useMutation(pharmacyApi.adjust.mutationOptions({ onSuccess }));
	const dispose = useMutation(pharmacyApi.disposeExpired.mutationOptions({ onSuccess }));
	const damaged = useMutation(pharmacyApi.recordDamaged.mutationOptions({ onSuccess }));
	const pending = adjust.isPending || dispose.isPending || damaged.isPending;
	const error = adjust.error ?? dispose.error ?? damaged.error;
	const amount = numberOrNull(quantity);
	const valid = amount !== null && amount > 0 && (kind === 'dispose' || reason.trim().length > 0);

	return (
		<form
			className={styles.form}
			onSubmit={(event) => {
				event.preventDefault();
				if (!valid || amount === null) {
					return;
				}
				if (kind === 'adjust') {
					adjust.mutate({ lotId: lot.id, direction, quantity: amount, reason: reason.trim() });
				} else if (kind === 'dispose') {
					dispose.mutate({ lotId: lot.id, quantity: amount, reason: reason.trim() || null });
				} else {
					damaged.mutate({ lotId: lot.id, quantity: amount, reason: reason.trim() });
				}
			}}
		>
			<DialogHeader>
				<DialogTitle>{TITLES[kind]}</DialogTitle>
				<DialogDescription>
					Lot {lot.lotNo} of {lot.itemName}: {qty(lot.quantityOnHand)} on hand. The stock ledger keeps this
					change; it is never edited afterwards.
				</DialogDescription>
			</DialogHeader>
			<div className={styles.fields}>
				{kind === 'adjust' && (
					<Field label='Direction'>
						{(id) => (
							<Select value={direction} onValueChange={(value) => setDirection(value as 'IN' | 'OUT')}>
								<SelectTrigger id={id} aria-label='Direction'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='OUT'>Less than the count (out)</SelectItem>
									<SelectItem value='IN'>More than the count (in)</SelectItem>
								</SelectContent>
							</Select>
						)}
					</Field>
				)}
				<Field label='Quantity' required>
					{(id) => (
						<Input
							id={id}
							type='number'
							min={0}
							step='0.01'
							inputMode='decimal'
							value={quantity}
							onChange={(event) => setQuantity(event.target.value)}
							required
						/>
					)}
				</Field>
				<Field label='Reason' required={kind !== 'dispose'} wide>
					{(id) => (
						<Input
							id={id}
							value={reason}
							placeholder={
								kind === 'adjust'
									? 'e.g. Monthly count: 3 short'
									: kind === 'damaged'
										? 'e.g. Vial dropped'
										: 'e.g. Handed to the disposal service'
							}
							onChange={(event) => setReason(event.target.value)}
							required={kind !== 'dispose'}
						/>
					)}
				</Field>
			</div>
			{error && <ErrorMessage message={error.message} />}
			<DialogFooter>
				<Button type='button' variant='outline' size='sm' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' size='sm' disabled={!valid || pending}>
					{TITLES[kind]}
				</Button>
			</DialogFooter>
		</form>
	);
}
