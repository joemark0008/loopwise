import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ItemDialog } from './item-dialog';
import { ItemFlags } from './items-page';
import { usePharmacyAccess } from './pharmacy-layout';
import styles from './pharmacy.module.css';
import { CATEGORY_LABELS, expiresIn, formatDate, MOVEMENT_LABELS, peso, qty, signedQty } from './pharmacy-format';
import { StockActionDialog } from './stock-action-dialog';
import type { StockAction } from './stock-action-dialog';
import type { InventoryLot } from '@/lib/pharmacy-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/feature/encounters/encounter-format';
import { pharmacyApi } from '@/lib/pharmacy-api';

/** One item: its details, its lots at this clinic (first expiry first) and its stock ledger (the stock card). */
export function ItemDetailPage({ itemId }: { itemId: string }) {
	const { canManageStock } = usePharmacyAccess();
	const [includeEmpty, setIncludeEmpty] = useState(false);
	const [editing, setEditing] = useState(false);
	const [action, setAction] = useState<{ kind: StockAction; lot: InventoryLot } | null>(null);
	const item = useQuery(pharmacyApi.item.queryOptions({ id: itemId }));
	const lots = useQuery(pharmacyApi.lots.queryOptions({ itemId, includeEmpty }));
	const ledger = useQuery(pharmacyApi.ledger.queryOptions({ itemId, limit: 200 }));

	if (item.isPending) {
		return <Skeleton />;
	}
	if (item.error) {
		return <ErrorMessage message={item.error.message} />;
	}
	const data = item.data;
	return (
		<div className={styles.form}>
			<PageSection title={data.displayName}>
				<div className={styles.toolbar}>
					<Link to='/pharmacy/items'>All items</Link>
					{canManageStock && (
						<Button size='sm' variant='outline' onClick={() => setEditing(true)}>
							Edit item
						</Button>
					)}
				</div>
				<dl className={styles.rxHeader}>
					<div>
						<dt>SKU</dt>
						<dd className={styles.code}>{data.sku}</dd>
					</div>
					<div>
						<dt>Generic · brand</dt>
						<dd>
							{data.genericName ?? '—'} · {data.brandName ?? 'no brand'}
						</dd>
					</div>
					<div>
						<dt>Category</dt>
						<dd>{CATEGORY_LABELS[data.category]}</dd>
					</div>
					<div>
						<dt>FDA CPR</dt>
						<dd>{data.fdaCprNo ?? '—'}</dd>
					</div>
					<div>
						<dt>On hand (unexpired)</dt>
						<dd>
							{qty(data.usableOnHand)} {data.unitOfMeasure}
							{data.isLowStock && (
								<>
									{' '}
									<ClinicalFlag tone='abnormal'>Low</ClinicalFlag>
								</>
							)}
						</dd>
					</div>
					<div>
						<dt>Reorder level</dt>
						<dd>{data.reorderLevel == null ? '—' : qty(data.reorderLevel)}</dd>
					</div>
					<div>
						<dt>Sold as</dt>
						<dd>
							{data.serviceItem
								? `${data.serviceItem.code} · ${peso(data.serviceItem.price)}`
								: `Not linked · ${peso(data.sellingPrice)}`}
						</dd>
					</div>
					<div>
						<dt>Storage</dt>
						<dd>{data.storageCondition ?? '—'}</dd>
					</div>
				</dl>
				<ItemFlags item={data} />
			</PageSection>

			<PageSection title='Lots at this clinic' meta={lots.data ? String(lots.data.length) : undefined}>
				<label className={styles.checkboxRow}>
					<Checkbox checked={includeEmpty} onCheckedChange={setIncludeEmpty} />
					Show used-up lots
				</label>
				{lots.isPending ? (
					<Skeleton />
				) : lots.error ? (
					<ErrorMessage message={lots.error.message} />
				) : lots.data.length === 0 ? (
					<EmptyState title='No stock at this clinic'>Receive a delivery to add a lot.</EmptyState>
				) : (
					<div className={pageStyles.tableScroll}>
						<table className={pageStyles.table} data-reflow data-testid='item-lots'>
							<caption className='sr-only'>Lots</caption>
							<thead>
								<tr>
									<th scope='col'>Lot</th>
									<th scope='col'>Expiry</th>
									<th scope='col' data-numeric>
										On hand
									</th>
									<th scope='col' data-numeric>
										Unit cost
									</th>
									<th scope='col'>Supplier</th>
									<th scope='col'>
										<span className='sr-only'>Actions</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{lots.data.map((lot) => (
									<tr key={lot.id}>
										<td data-label='Lot' className={styles.code}>
											{lot.lotNo}
										</td>
										<td data-label='Expiry'>
											{lot.alert ? (
												<ClinicalFlag tone={lot.alert === 'EXPIRED' ? 'critical' : 'abnormal'}>
													{expiresIn(lot.daysToExpiry)}
												</ClinicalFlag>
											) : (
												expiresIn(lot.daysToExpiry)
											)}
											<div className={styles.muted}>{formatDate(lot.expiryDate)}</div>
										</td>
										<td data-label='On hand' data-numeric>
											{qty(lot.quantityOnHand)}
										</td>
										<td data-label='Unit cost' data-numeric>
											{peso(lot.unitCost)}
										</td>
										<td data-label='Supplier'>{lot.supplierName ?? '—'}</td>
										<td data-label='Actions'>
											{canManageStock && lot.quantityOnHand > 0 && (
												<div className={styles.actions}>
													{lot.alert === 'EXPIRED' ? (
														<Button
															size='sm'
															variant='outline'
															onClick={() => setAction({ kind: 'dispose', lot })}
														>
															Dispose
														</Button>
													) : (
														<>
															<Button
																size='sm'
																variant='ghost'
																onClick={() => setAction({ kind: 'adjust', lot })}
																aria-label={`Adjust lot ${lot.lotNo}`}
															>
																Adjust
															</Button>
															<Button
																size='sm'
																variant='ghost'
																onClick={() => setAction({ kind: 'damaged', lot })}
																aria-label={`Damaged stock of lot ${lot.lotNo}`}
															>
																Damaged
															</Button>
														</>
													)}
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</PageSection>

			<PageSection title='Stock ledger' meta='Newest first; rows are never edited'>
				{ledger.isPending ? (
					<Skeleton />
				) : ledger.error ? (
					<ErrorMessage message={ledger.error.message} />
				) : ledger.data.length === 0 ? (
					<EmptyState title='No movements yet' />
				) : (
					<div className={pageStyles.tableScroll}>
						<table className={pageStyles.table} data-reflow data-testid='stock-ledger'>
							<caption className='sr-only'>Stock ledger</caption>
							<thead>
								<tr>
									<th scope='col'>When</th>
									<th scope='col'>Movement</th>
									<th scope='col'>Lot</th>
									<th scope='col' data-numeric>
										Quantity
									</th>
									<th scope='col' data-numeric>
										Balance
									</th>
									<th scope='col'>Reference</th>
									<th scope='col'>By</th>
								</tr>
							</thead>
							<tbody>
								{ledger.data.map((row) => (
									<tr key={row.id} data-testid='ledger-row'>
										<td data-label='When' className={styles.nowrap}>
											{formatDateTime(row.performedAt)}
										</td>
										<td data-label='Movement'>
											{MOVEMENT_LABELS[row.type]}
											{row.reason && <div className={styles.muted}>{row.reason}</div>}
										</td>
										<td data-label='Lot' className={styles.code}>
											{row.lotNo ?? '—'}
										</td>
										<td data-label='Quantity' data-numeric>
											{signedQty(row.quantity)}
										</td>
										<td data-label='Balance' data-numeric>
											{row.balanceAfter == null ? '—' : qty(row.balanceAfter)}
										</td>
										<td data-label='Reference'>{row.rxNo ?? row.receiptNo ?? '—'}</td>
										<td data-label='By'>{row.performedByName ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</PageSection>
			<ItemDialog item={editing ? data : null} onClose={() => setEditing(false)} />
			<StockActionDialog action={action} onClose={() => setAction(null)} />
		</div>
	);
}
