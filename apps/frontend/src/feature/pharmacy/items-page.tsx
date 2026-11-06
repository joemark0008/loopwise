import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Boxes } from 'lucide-react';
import { useState } from 'react';
import { ItemDialog } from './item-dialog';
import { usePharmacyAccess } from './pharmacy-layout';
import styles from './pharmacy.module.css';
import { CATEGORY_LABELS, formatDate, peso, qty } from './pharmacy-format';
import type { InventoryItem } from '@/lib/pharmacy-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { pharmacyApi } from '@/lib/pharmacy-api';

/** The item's regulatory flags as chips (never colour alone). */
export function ItemFlags({
	item,
}: {
	item: Pick<InventoryItem, 'isDangerousDrug' | 'isRxOnly' | 'isAntimicrobial' | 'isPnf'>;
}) {
	return (
		<div className={styles.flags}>
			{item.isDangerousDrug && <ClinicalFlag tone='critical'>Dangerous drug</ClinicalFlag>}
			{item.isRxOnly && !item.isDangerousDrug && <ClinicalFlag tone='info'>Rx only</ClinicalFlag>}
			{item.isAntimicrobial && <ClinicalFlag tone='info'>Antimicrobial</ClinicalFlag>}
			{item.isPnf && <ClinicalFlag tone='draft'>PNF</ClinicalFlag>}
		</div>
	);
}

/** Pharmacy → Items: the inventory master, generic name first, with stock at this clinic. */
export function ItemsPage() {
	const { canManageStock } = usePharmacyAccess();
	const [search, setSearch] = useState('');
	const [includeInactive, setIncludeInactive] = useState(false);
	const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
	const items = useQuery(
		pharmacyApi.items.queryOptions(
			{ search: search.trim() || null, includeInactive },
			{ placeholderData: (previous) => previous },
		),
	);

	return (
		<PageSection title='Items' meta={items.data ? String(items.data.length) : undefined}>
			<div className={styles.toolbar}>
				<div className={styles.toolbarStart}>
					<Input
						className={styles.search}
						type='search'
						aria-label='Search items'
						placeholder='Search by generic, brand, name or SKU'
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<label className={styles.checkboxRow}>
						<Checkbox checked={includeInactive} onCheckedChange={setIncludeInactive} />
						Show inactive
					</label>
				</div>
				{canManageStock && (
					<Button size='sm' onClick={() => setEditing('new')}>
						Add item
					</Button>
				)}
			</div>
			{items.isPending ? (
				<Skeleton />
			) : items.error ? (
				<ErrorMessage message={items.error.message} />
			) : items.data.length === 0 ? (
				<EmptyState icon={Boxes} title={search ? 'No item matches' : 'No items yet'}>
					{search ? 'Try the generic name or the SKU.' : 'Add the medicines and supplies the clinic keeps.'}
				</EmptyState>
			) : (
				<div className={pageStyles.tableScroll}>
					<table className={pageStyles.table} data-reflow data-testid='inventory-items'>
						<caption className='sr-only'>Inventory items</caption>
						<thead>
							<tr>
								<th scope='col'>Item</th>
								<th scope='col'>Category</th>
								<th scope='col' data-numeric>
									On hand
								</th>
								<th scope='col'>Nearest expiry</th>
								<th scope='col' data-numeric>
									Price
								</th>
								<th scope='col'>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{items.data.map((item) => (
								<tr key={item.id} data-testid='inventory-item-row'>
									<td data-label='Item'>
										<Link
											to='/pharmacy/items/$itemId'
											params={{ itemId: item.id }}
											className={styles.main}
										>
											{item.displayName}
										</Link>
										<div className={styles.muted}>
											{item.sku}
											{item.fdaCprNo && ` · CPR ${item.fdaCprNo}`}
											{!item.isActive && ' · inactive'}
										</div>
										<ItemFlags item={item} />
									</td>
									<td data-label='Category'>{CATEGORY_LABELS[item.category]}</td>
									<td data-label='On hand' data-numeric>
										{item.isLowStock ? (
											<ClinicalFlag tone='abnormal'>
												Low · {qty(item.usableOnHand)} {item.unitOfMeasure}
											</ClinicalFlag>
										) : (
											`${qty(item.usableOnHand)} ${item.unitOfMeasure}`
										)}
									</td>
									<td data-label='Nearest expiry'>{formatDate(item.nearestExpiry)}</td>
									<td data-label='Price' data-numeric>
										{peso(item.serviceItem?.price ?? item.sellingPrice)}
									</td>
									<td data-label='Actions'>
										{canManageStock && (
											<Button
												variant='ghost'
												size='sm'
												aria-label={`Edit ${item.displayName}`}
												onClick={() => setEditing(item)}
											>
												Edit
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<ItemDialog item={editing} onClose={() => setEditing(null)} />
		</PageSection>
	);
}
