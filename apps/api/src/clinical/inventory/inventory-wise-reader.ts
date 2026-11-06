import type { findStock, listInventoryAlerts } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { InvalidInputError } from '../patients/patients.errors.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { InventoryAccess } from './inventory-access.js';
import { InventoryItemRepository } from './items/inventory-item.repository.js';
import { toInventoryItem } from './items/models/inventory-item.model.js';
import { toLot } from './stock/models/stock.model.js';
import { StockRepository } from './stock/stock.repository.js';
import { StockQueryService } from './stock/stock-query.service.js';
import { EXPIRING_WITHIN_DAYS, fefoOrder, manilaToday } from './stock/stock-rules.js';

/**
 * The read methods Wise's pharmacy tools call (`find_stock`, `list_inventory_alerts`), as the user at the chat's
 * clinic: only its pharmacy and stock-room staff (and admins), under row-level security, each read audited. Stock is
 * never changed from chat.
 */
@Injectable()
export class InventoryWiseReader {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly access: InventoryAccess,
		private readonly items: InventoryItemRepository,
		private readonly stock: StockRepository,
		private readonly query: StockQueryService,
		private readonly audit: AuditService,
	) {}

	async stockForWise(
		userId: string,
		clinicId: string | null,
		input: findStock.Input & { limit: number },
	): Promise<Omit<findStock.Output, '_version'>> {
		const actor = await this.access.atClinic(userId, requireClinic(clinicId), 'read');
		const today = manilaToday();
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.items.list(tx, actor.organizationId, actor.clinicId, { search: input.query });
			const shown = rows.slice(0, input.limit);
			const lots = await this.stock.listLots(
				tx,
				actor.clinicId,
				shown.map((row) => row.id),
			);
			const clinic = await this.stock.clinicName(tx, actor.clinicId);
			await this.audit.view(tx, {
				event: 'inventory.stock.read',
				entityType: 'InventoryItem',
				userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				reason: `Wise find_stock: ${input.query}`,
			});
			return {
				clinicName: clinic,
				asOf: today,
				truncated: rows.length > input.limit,
				items: shown.map((row) => {
					const item = toInventoryItem(row, today);
					const own = lots.filter((lot) => lot.itemId === row.id).map((lot) => toLot(lot, today));
					return {
						id: item.id,
						sku: item.sku,
						name: item.displayName,
						genericName: item.genericName,
						unit: item.unitOfMeasure,
						usableOnHand: item.usableOnHand,
						onHand: item.onHand,
						reorderLevel: item.reorderLevel,
						isLowStock: item.isLowStock,
						isDangerousDrug: item.isDangerousDrug,
						lots: [...fefoOrder(own, today), ...own.filter((lot) => lot.alert === 'EXPIRED')].map(
							(lot) => ({
								lotNo: lot.lotNo,
								expiryDate: lot.expiryDate,
								quantityOnHand: lot.quantityOnHand,
								alert: lot.alert,
							}),
						),
					};
				}),
			};
		});
	}

	async alertsForWise(
		userId: string,
		clinicId: string | null,
		input: listInventoryAlerts.Input & { limit: number },
	): Promise<Omit<listInventoryAlerts.Output, '_version'>> {
		const actor = await this.access.atClinic(userId, requireClinic(clinicId), 'read');
		const withinDays = input.withinDays ?? EXPIRING_WITHIN_DAYS;
		return this.db.asUser(userId, async (tx) => {
			const alerts = await this.query.alertsOn(tx, actor, withinDays);
			const clinic = await this.stock.clinicName(tx, actor.clinicId);
			await this.audit.view(tx, {
				event: 'inventory.alerts.read',
				entityType: 'InventoryLot',
				userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				reason: `Wise list_inventory_alerts${input.kind ? `: ${input.kind}` : ''}`,
			});
			const wants = (kind: listInventoryAlerts.AlertKind) => !input.kind || input.kind === kind;
			const lot = (row: (typeof alerts.expiring)[number]) => ({
				itemId: row.itemId,
				name: row.itemName,
				lotNo: row.lotNo,
				expiryDate: row.expiryDate,
				daysToExpiry: row.daysToExpiry,
				quantityOnHand: row.quantityOnHand,
			});
			return {
				clinicName: clinic,
				asOf: alerts.asOf,
				withinDays,
				lowStock: wants('LOW_STOCK')
					? alerts.lowStock.slice(0, input.limit).map((item) => ({
							itemId: item.itemId,
							name: item.itemName,
							unit: item.unitOfMeasure,
							usableOnHand: item.usableOnHand,
							reorderLevel: item.reorderLevel,
						}))
					: [],
				expiring: wants('EXPIRING') ? alerts.expiring.slice(0, input.limit).map(lot) : [],
				expired: wants('EXPIRED') ? alerts.expired.slice(0, input.limit).map(lot) : [],
			};
		});
	}
}

function requireClinic(clinicId: string | null): string {
	if (!clinicId) {
		throw new InvalidInputError('This chat has no clinic. Open Wise from one of your clinics.');
	}
	return clinicId;
}
