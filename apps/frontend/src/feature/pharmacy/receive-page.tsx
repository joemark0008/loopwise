import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Truck } from 'lucide-react';
import { useState } from 'react';
import { usePharmacyAccess } from './pharmacy-layout';
import styles from './pharmacy.module.css';
import { formatDate, numberOrNull, orNull, peso, qty } from './pharmacy-format';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { Field } from '@/feature/settings/clinic-setup/setup-form';
import { pharmacyApi } from '@/lib/pharmacy-api';

interface Line {
	key: number;
	itemId: string;
	lotNo: string;
	expiryDate: string;
	quantity: string;
	unitCost: string;
}

let nextKey = 1;
const emptyLine = (): Line => ({ key: nextKey++, itemId: '', lotNo: '', expiryDate: '', quantity: '', unitCost: '' });

/**
 * Pharmacy → Receive stock: a supplier's delivery (DR and invoice numbers) into this clinic, one row per lot (lot
 * number, expiry, quantity in units, unit cost). Each row creates the lot or adds to the same lot on file and writes a
 * RECEIPT row of the ledger. Below, the latest deliveries.
 */
export function ReceivePage() {
	const { canManageStock } = usePharmacyAccess();
	const receipts = useQuery(pharmacyApi.receipts.queryOptions({ limit: 20 }));
	return (
		<div className={styles.form}>
			{canManageStock && <ReceiveForm />}
			<PageSection title='Latest deliveries' meta={receipts.data ? String(receipts.data.length) : undefined}>
				{receipts.isPending ? (
					<Skeleton />
				) : receipts.error ? (
					<ErrorMessage message={receipts.error.message} />
				) : receipts.data.length === 0 ? (
					<EmptyState icon={Truck} title='No deliveries yet' />
				) : (
					<div className={pageStyles.tableScroll}>
						<table className={pageStyles.table} data-reflow data-testid='stock-receipts'>
							<caption className='sr-only'>Latest deliveries</caption>
							<thead>
								<tr>
									<th scope='col'>Receiving no.</th>
									<th scope='col'>Supplier</th>
									<th scope='col'>Lots</th>
									<th scope='col' data-numeric>
										Total cost
									</th>
									<th scope='col'>Received</th>
								</tr>
							</thead>
							<tbody>
								{receipts.data.map((receipt) => (
									<tr key={receipt.id}>
										<td data-label='Receiving no.'>
											<div className={styles.code}>{receipt.receiptNo}</div>
											<div className={styles.muted}>
												{[
													receipt.deliveryReceiptNo && `DR ${receipt.deliveryReceiptNo}`,
													receipt.supplierInvoiceNo && `SI ${receipt.supplierInvoiceNo}`,
												]
													.filter(Boolean)
													.join(' · ') || '—'}
											</div>
										</td>
										<td data-label='Supplier'>{receipt.supplierName}</td>
										<td data-label='Lots'>
											{receipt.lines.map((line) => (
												<div key={line.id}>
													<Link to='/pharmacy/items/$itemId' params={{ itemId: line.itemId }}>
														{line.itemName}
													</Link>{' '}
													<span className={styles.muted}>
														{line.lotNo} · {qty(line.quantity)} · exp{' '}
														{formatDate(line.expiryDate)}
													</span>
												</div>
											))}
										</td>
										<td data-label='Total cost' data-numeric>
											{peso(receipt.totalCost)}
										</td>
										<td data-label='Received' className={styles.nowrap}>
											{formatDateTime(receipt.receivedAt)}
											<div className={styles.muted}>{receipt.receivedByName ?? ''}</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</PageSection>
		</div>
	);
}

function ReceiveForm() {
	const queryClient = useQueryClient();
	const suppliers = useQuery(pharmacyApi.suppliers.queryOptions({}));
	const items = useQuery(pharmacyApi.items.queryOptions({}));
	const [supplierId, setSupplierId] = useState('');
	const [deliveryReceiptNo, setDeliveryReceiptNo] = useState('');
	const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
	const [lines, setLines] = useState<Line[]>(() => [emptyLine()]);
	const [done, setDone] = useState<string | null>(null);
	const receive = useMutation(
		pharmacyApi.receive.mutationOptions({
			onSuccess: async (receipt) => {
				setDone(`Received as ${receipt.receiptNo} (${peso(receipt.totalCost)}).`);
				setLines([emptyLine()]);
				setDeliveryReceiptNo('');
				setSupplierInvoiceNo('');
				await queryClient.invalidateQueries(pharmacyApi.all.pathFilter());
			},
		}),
	);
	const setLine = (key: number, patch: Partial<Line>) =>
		setLines(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
	const parsed = lines.map((line) => ({
		line,
		quantity: numberOrNull(line.quantity),
		unitCost: numberOrNull(line.unitCost),
	}));
	const valid =
		supplierId &&
		parsed.every(
			({ line, quantity, unitCost }) =>
				line.itemId &&
				line.lotNo.trim() &&
				quantity !== null &&
				quantity > 0 &&
				unitCost !== null &&
				unitCost >= 0,
		);

	return (
		<PageSection title='Receive a delivery'>
			<form
				className={styles.form}
				onSubmit={(event) => {
					event.preventDefault();
					if (!valid) {
						return;
					}
					setDone(null);
					receive.mutate({
						supplierId,
						deliveryReceiptNo: orNull(deliveryReceiptNo),
						supplierInvoiceNo: orNull(supplierInvoiceNo),
						lines: parsed.map(({ line, quantity, unitCost }) => ({
							itemId: line.itemId,
							lotNo: line.lotNo.trim(),
							expiryDate: line.expiryDate || null,
							quantity: quantity ?? 0,
							unitCost: unitCost ?? 0,
						})),
					});
				}}
			>
				<div className={styles.fields}>
					<Field label='Supplier' required>
						{(id) => (
							<Select value={supplierId} onValueChange={setSupplierId}>
								<SelectTrigger id={id} aria-label='Supplier'>
									<SelectValue placeholder='Choose the supplier' />
								</SelectTrigger>
								<SelectContent>
									{(suppliers.data ?? []).map((supplier) => (
										<SelectItem key={supplier.id} value={supplier.id}>
											{supplier.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</Field>
					<Field label='DR no.'>
						{(id) => (
							<Input
								id={id}
								value={deliveryReceiptNo}
								onChange={(event) => setDeliveryReceiptNo(event.target.value)}
							/>
						)}
					</Field>
					<Field label='Supplier invoice no.'>
						{(id) => (
							<Input
								id={id}
								value={supplierInvoiceNo}
								onChange={(event) => setSupplierInvoiceNo(event.target.value)}
							/>
						)}
					</Field>
				</div>
				{lines.map((line, index) => (
					<fieldset key={line.key} className={styles.lineRow} aria-label={`Line ${index + 1}`}>
						<Field label='Item' required>
							{(id) => (
								<Select value={line.itemId} onValueChange={(itemId) => setLine(line.key, { itemId })}>
									<SelectTrigger id={id} aria-label={`Item of line ${index + 1}`}>
										<SelectValue placeholder='Choose the item' />
									</SelectTrigger>
									<SelectContent>
										{(items.data ?? []).map((item) => (
											<SelectItem key={item.id} value={item.id}>
												{item.displayName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
						<Field label='Lot no.' required>
							{(id) => (
								<Input
									id={id}
									value={line.lotNo}
									onChange={(event) => setLine(line.key, { lotNo: event.target.value })}
									required
								/>
							)}
						</Field>
						<Field label='Expiry'>
							{(id) => (
								<Input
									id={id}
									type='date'
									value={line.expiryDate}
									onChange={(event) => setLine(line.key, { expiryDate: event.target.value })}
								/>
							)}
						</Field>
						<Field label='Quantity' required>
							{(id) => (
								<Input
									id={id}
									type='number'
									min={0}
									step='1'
									inputMode='decimal'
									value={line.quantity}
									onChange={(event) => setLine(line.key, { quantity: event.target.value })}
									required
								/>
							)}
						</Field>
						<Field label='Unit cost (₱)' required>
							{(id) => (
								<Input
									id={id}
									type='number'
									min={0}
									step='0.01'
									inputMode='decimal'
									value={line.unitCost}
									onChange={(event) => setLine(line.key, { unitCost: event.target.value })}
									required
								/>
							)}
						</Field>
						<Button
							type='button'
							variant='ghost'
							size='sm'
							disabled={lines.length === 1}
							onClick={() => setLines(lines.filter((other) => other.key !== line.key))}
							aria-label={`Remove line ${index + 1}`}
						>
							Remove
						</Button>
					</fieldset>
				))}
				{receive.error && <ErrorMessage message={receive.error.message} />}
				{done && (
					<p role='status' className={styles.muted}>
						{done}
					</p>
				)}
				<div className={styles.actions}>
					<Button type='button' variant='outline' size='sm' onClick={() => setLines([...lines, emptyLine()])}>
						Add a line
					</Button>
					<Button type='submit' size='sm' disabled={!valid || receive.isPending}>
						Receive stock
					</Button>
				</div>
			</form>
		</PageSection>
	);
}
