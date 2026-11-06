import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PackageCheck } from 'lucide-react';
import { usePharmacyAccess } from './pharmacy-layout';
import styles from './pharmacy.module.css';
import { expiresIn, formatDate, qty } from './pharmacy-format';
import type { InventoryLot } from '@/lib/pharmacy-api';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';
import { EmptyState } from '@/components/clinical/empty-state';
import { PageSection } from '@/components/clinical/page-header';
import pageStyles from '@/components/clinical/page.module.css';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { pharmacyApi } from '@/lib/pharmacy-api';

/**
 * Pharmacy → Overview: prescriptions waiting, and the stock alerts of the clinic (low stock at or below the reorder
 * level, lots expiring within 90 days, expired lots still on the shelf to dispose of).
 */
export function PharmacyDashboard() {
	const { canDispense } = usePharmacyAccess();
	const alerts = useQuery(pharmacyApi.alerts.queryOptions({}));
	const queue = useQuery(pharmacyApi.queue.queryOptions({}, { enabled: canDispense }));

	if (alerts.isPending) {
		return <Skeleton />;
	}
	if (alerts.error) {
		return <ErrorMessage message={alerts.error.message} />;
	}
	const data = alerts.data;
	return (
		<div className={styles.form}>
			<div className={styles.stats}>
				{canDispense && (
					<Link to='/pharmacy/dispense' className={styles.stat} data-testid='stat-waiting'>
						<span className={styles.statValue}>{queue.data ? queue.data.length : '…'}</span>
						<span className={styles.statLabel}>Prescriptions to dispense</span>
					</Link>
				)}
				<a href='#low-stock' className={styles.stat} data-testid='stat-low'>
					<span className={styles.statValue}>{data.lowStock.length}</span>
					<span className={styles.statLabel}>Items low on stock</span>
				</a>
				<a href='#expiring' className={styles.stat} data-testid='stat-expiring'>
					<span className={styles.statValue}>{data.expiring.length}</span>
					<span className={styles.statLabel}>Lots expiring in {data.expiringWithinDays} days</span>
				</a>
				<a href='#expired' className={styles.stat} data-testid='stat-expired'>
					<span className={styles.statValue}>{data.expired.length}</span>
					<span className={styles.statLabel}>Expired lots on the shelf</span>
				</a>
			</div>
			<div className={styles.grid}>
				<PageSection title='Low stock' labelledBy='low-stock' meta={`as of ${formatDate(data.asOf)}`}>
					{data.lowStock.length === 0 ? (
						<EmptyState icon={PackageCheck} title='Nothing low on stock'>
							Items show here when their unexpired stock is at or below the reorder level.
						</EmptyState>
					) : (
						<div className={pageStyles.tableScroll}>
							<table className={pageStyles.table} data-reflow data-testid='low-stock'>
								<thead>
									<tr>
										<th scope='col'>Item</th>
										<th scope='col' data-numeric>
											On hand
										</th>
										<th scope='col' data-numeric>
											Reorder at
										</th>
									</tr>
								</thead>
								<tbody>
									{data.lowStock.map((item) => (
										<tr key={item.itemId}>
											<td data-label='Item'>
												<Link to='/pharmacy/items/$itemId' params={{ itemId: item.itemId }}>
													{item.itemName}
												</Link>
												<div className={styles.muted}>{item.sku}</div>
											</td>
											<td data-label='On hand' data-numeric>
												<ClinicalFlag tone='abnormal'>
													{qty(item.usableOnHand)} {item.unitOfMeasure}
												</ClinicalFlag>
											</td>
											<td data-label='Reorder at' data-numeric>
												{qty(item.reorderLevel)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</PageSection>
				<LotAlerts
					id='expiring'
					title={`Expiring within ${data.expiringWithinDays} days`}
					lots={data.expiring}
					empty='No lot in stock expires that soon.'
				/>
				<LotAlerts
					id='expired'
					title='Expired, to dispose of'
					lots={data.expired}
					empty='No expired stock on the shelf.'
				/>
			</div>
		</div>
	);
}

function LotAlerts({ id, title, lots, empty }: { id: string; title: string; lots: InventoryLot[]; empty: string }) {
	return (
		<PageSection title={title} labelledBy={id}>
			{lots.length === 0 ? (
				<EmptyState icon={PackageCheck} title={empty} />
			) : (
				<div className={pageStyles.tableScroll}>
					<table className={pageStyles.table} data-reflow data-testid={`${id}-lots`}>
						<thead>
							<tr>
								<th scope='col'>Item</th>
								<th scope='col'>Lot</th>
								<th scope='col'>Expiry</th>
								<th scope='col' data-numeric>
									On hand
								</th>
							</tr>
						</thead>
						<tbody>
							{lots.map((lot) => (
								<tr key={lot.id}>
									<td data-label='Item'>
										<Link to='/pharmacy/items/$itemId' params={{ itemId: lot.itemId }}>
											{lot.itemName}
										</Link>
									</td>
									<td data-label='Lot' className={styles.code}>
										{lot.lotNo}
									</td>
									<td data-label='Expiry'>
										<ClinicalFlag tone={lot.alert === 'EXPIRED' ? 'critical' : 'abnormal'}>
											{expiresIn(lot.daysToExpiry)}
										</ClinicalFlag>
										<div className={styles.muted}>{formatDate(lot.expiryDate)}</div>
									</td>
									<td data-label='On hand' data-numeric>
										{qty(lot.quantityOnHand)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</PageSection>
	);
}
