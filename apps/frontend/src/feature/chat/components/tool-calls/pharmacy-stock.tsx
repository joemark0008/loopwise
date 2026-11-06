import { Link } from '@tanstack/react-router';
import { Pill, TriangleAlert } from 'lucide-react';
import { memo } from 'react';
import styles from './propose-action.module.css';
import type { findStock, listInventoryAlerts } from '@loopwise/shared/tools';
import type { ToolCallComponentProps } from '.';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { expiresIn, formatDate, qty } from '@/feature/pharmacy/pharmacy-format';

/** `find_stock`: the matching items with their unexpired stock and lots, first expiry first. Read only. */
export const FindStockToolCall = memo(({ toolPart }: ToolCallComponentProps<'find_stock'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as findStock.Output | undefined;
	if (!output) {
		return null;
	}
	return (
		<div className={styles.resultsCard} data-testid='find-stock'>
			<p className={styles.resultsTitle}>
				<Pill aria-hidden /> Stock at {output.clinicName}
				<Link to='/pharmacy/items' className={styles.link}>
					Open the items
				</Link>
			</p>
			{output.items.length === 0 ? (
				<p className={styles.meta}>No item matches.</p>
			) : (
				<ul className={styles.list}>
					{output.items.map((item) => (
						<li key={item.id} data-urgency={item.isLowStock ? 'critical' : undefined}>
							<strong>{item.name}</strong> · {qty(item.usableOnHand)} {item.unit}
							{item.isLowStock && ' · low'}
							{item.isDangerousDrug && ' · dangerous drug'}
							{item.lots.length > 0 &&
								` · ${item.lots
									.slice(0, 3)
									.map(
										(lot) =>
											`${lot.lotNo} (${qty(lot.quantityOnHand)}, exp ${formatDate(lot.expiryDate)})`,
									)
									.join(', ')}`}
						</li>
					))}
				</ul>
			)}
			{output.truncated && <p className={styles.meta}>More items match; narrow the search.</p>}
		</div>
	);
});

/** `list_inventory_alerts`: low stock, expiring and expired lots. Read only. */
export const ListInventoryAlertsToolCall = memo(({ toolPart }: ToolCallComponentProps<'list_inventory_alerts'>) => {
	if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
		return <Skeleton className={styles.skeleton} />;
	}
	if (toolPart.state === 'output-error') {
		return <ErrorMessage message={toolPart.errorText} />;
	}
	const output = toolPart.output as listInventoryAlerts.Output | undefined;
	if (!output) {
		return null;
	}
	const empty = output.lowStock.length + output.expiring.length + output.expired.length === 0;
	return (
		<div className={styles.resultsCard} data-testid='inventory-alerts'>
			<p className={styles.resultsTitle}>
				<TriangleAlert aria-hidden /> Stock alerts at {output.clinicName}
				<Link to='/pharmacy' className={styles.link}>
					Open the pharmacy
				</Link>
			</p>
			{empty ? (
				<p className={styles.meta}>No alerts.</p>
			) : (
				<ul className={styles.list}>
					{output.expired.map((lot) => (
						<li key={`expired-${lot.lotNo}-${lot.itemId}`} data-urgency='critical'>
							<strong>{lot.name}</strong> · lot {lot.lotNo} · {expiresIn(lot.daysToExpiry)} ·{' '}
							{qty(lot.quantityOnHand)} on the shelf
						</li>
					))}
					{output.expiring.map((lot) => (
						<li key={`expiring-${lot.lotNo}-${lot.itemId}`}>
							<strong>{lot.name}</strong> · lot {lot.lotNo} · {expiresIn(lot.daysToExpiry)} ·{' '}
							{qty(lot.quantityOnHand)} left
						</li>
					))}
					{output.lowStock.map((item) => (
						<li key={`low-${item.itemId}`}>
							<strong>{item.name}</strong> · low: {qty(item.usableOnHand)} {item.unit} (reorder at{' '}
							{qty(item.reorderLevel)})
						</li>
					))}
				</ul>
			)}
		</div>
	);
});
