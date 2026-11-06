import { Injectable } from '@nestjs/common';

import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InventoryAlertKind } from '../inventory.enums.js';
import { InventoryItemRepository } from '../items/inventory-item.repository.js';
import { InventoryItemService } from '../items/inventory-item.service.js';
import { toInventoryItem } from '../items/models/inventory-item.model.js';
import type { InventoryAlertsModel } from './models/inventory-alerts.model.js';
import { type InventoryLotModel, type StockMovementModel, toLot, toMovement } from './models/stock.model.js';
import { StockRepository } from './stock.repository.js';
import { EXPIRING_WITHIN_DAYS, lotAlert, manilaToday } from './stock-rules.js';

/**
 * Reading stock at the selected clinic: an item's lots, its ledger (the stock card), and the dashboard's alerts (low
 * stock at or below the reorder level, lots expiring within 90 days, expired lots still on the shelf). As the user;
 * stock levels carry no patient data, so reads aren't audited.
 */
@Injectable()
export class StockQueryService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly stock: StockRepository,
		private readonly itemRows: InventoryItemRepository,
		private readonly items: InventoryItemService,
	) {}

	lots(actor: ClinicActor, itemId: string, includeEmpty: boolean): Promise<InventoryLotModel[]> {
		const today = manilaToday();
		return this.db.asUser(actor.userId, async (tx) => {
			await this.items.require(tx, actor, itemId);
			return (await this.stock.listLots(tx, actor.clinicId, [itemId], includeEmpty)).map((lot) =>
				toLot(lot, today),
			);
		});
	}

	ledger(actor: ClinicActor, itemId: string, limit: number): Promise<StockMovementModel[]> {
		return this.db.asUser(actor.userId, async (tx) => {
			await this.items.require(tx, actor, itemId);
			const rows = await this.stock.listMovements(tx, actor.clinicId, itemId, limit);
			const names = await this.stock.userNames(
				tx,
				rows.flatMap((row) => row.performedById ?? []),
			);
			return rows.map((row) => toMovement(row, names));
		});
	}

	alerts(actor: ClinicActor, withinDays = EXPIRING_WITHIN_DAYS): Promise<InventoryAlertsModel> {
		return this.db.asUser(actor.userId, (tx) => this.alertsOn(tx, actor, withinDays));
	}

	/** The alerts on the caller's transaction (Wise's reader audits its own read). */
	async alertsOn(tx: ClinicalTx, actor: ClinicActor, withinDays: number): Promise<InventoryAlertsModel> {
		const today = manilaToday();
		const items = (await this.itemRows.list(tx, actor.organizationId, actor.clinicId, {})).map((row) =>
			toInventoryItem(row, today),
		);
		const lots = await this.stock.listLotsWithStock(tx, actor.clinicId);
		const withAlert = lots.map((lot) => ({
			lot: toLot(lot, today),
			alert: lotAlert(
				{ expiryDate: lot.expiryDate?.toISOString().slice(0, 10) ?? null, quantityOnHand: 1 },
				today,
				withinDays,
			),
		}));
		return {
			asOf: today,
			expiringWithinDays: withinDays,
			lowStock: items
				.filter((item) => item.isLowStock && item.reorderLevel !== null)
				.map((item) => ({
					itemId: item.id,
					sku: item.sku,
					itemName: item.displayName,
					unitOfMeasure: item.unitOfMeasure,
					usableOnHand: item.usableOnHand,
					reorderLevel: item.reorderLevel ?? 0,
				})),
			expiring: withAlert
				.filter(({ alert }) => alert === 'EXPIRING')
				.map(({ lot }) => ({ ...lot, alert: InventoryAlertKind.EXPIRING })),
			expired: withAlert.filter(({ alert }) => alert === 'EXPIRED').map(({ lot }) => lot),
		};
	}
}
