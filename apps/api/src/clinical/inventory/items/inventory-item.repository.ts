import { Injectable } from '@nestjs/common';

import type { ItemCategory, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { type InventoryItemRow, itemInclude } from './models/inventory-item.model.js';

export interface ItemFilter {
	search?: string | null;
	category?: ItemCategory | null;
	includeInactive?: boolean;
}

/** The catalog service an item can be linked to. */
export interface ServiceLinkRow {
	id: string;
	code: string;
	name: string;
	category: string;
	inventoryItemId: string | null;
	isActive: boolean;
}

/**
 * The organization's inventory master (`inventory_items`) and its link to the catalog (`service_items.inventory_item_id`),
 * under row-level security (the organization's staff). Every method takes the caller's transaction.
 */
@Injectable()
export class InventoryItemRepository {
	list(tx: ClinicalTx, organizationId: string, clinicId: string, filter: ItemFilter): Promise<InventoryItemRow[]> {
		const search = filter.search?.trim();
		return tx.inventoryItem.findMany({
			where: {
				organizationId,
				...(filter.includeInactive ? {} : { isActive: true }),
				...(filter.category ? { category: filter.category } : {}),
				...(search
					? {
							OR: [
								{ name: { contains: search, mode: 'insensitive' } },
								{ genericName: { contains: search, mode: 'insensitive' } },
								{ brandName: { contains: search, mode: 'insensitive' } },
								{ sku: { contains: search, mode: 'insensitive' } },
								{ barcode: search },
							],
						}
					: {}),
			},
			include: itemInclude(clinicId),
			orderBy: [{ genericName: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
		});
	}

	find(tx: ClinicalTx, id: string, clinicId: string): Promise<InventoryItemRow | null> {
		return tx.inventoryItem.findUnique({ where: { id }, include: itemInclude(clinicId) });
	}

	/** Active items with the same generic name (case-insensitive): what may stand in for a prescribed medicine. */
	listByGeneric(
		tx: ClinicalTx,
		organizationId: string,
		clinicId: string,
		genericNames: readonly string[],
	): Promise<InventoryItemRow[]> {
		return tx.inventoryItem.findMany({
			where: {
				organizationId,
				isActive: true,
				OR: genericNames.map((genericName) => ({ genericName: { equals: genericName, mode: 'insensitive' } })),
			},
			include: itemInclude(clinicId),
			orderBy: { name: 'asc' },
		});
	}

	findBySku(tx: ClinicalTx, organizationId: string, sku: string): Promise<{ id: string } | null> {
		return tx.inventoryItem.findUnique({
			where: { organizationId_sku: { organizationId, sku } },
			select: { id: true },
		});
	}

	create(
		tx: ClinicalTx,
		data: Prisma.InventoryItemUncheckedCreateInput,
		clinicId: string,
	): Promise<InventoryItemRow> {
		return tx.inventoryItem.create({ data, include: itemInclude(clinicId) });
	}

	update(
		tx: ClinicalTx,
		id: string,
		data: Prisma.InventoryItemUncheckedUpdateInput,
		clinicId: string,
	): Promise<InventoryItemRow> {
		return tx.inventoryItem.update({ where: { id }, data, include: itemInclude(clinicId) });
	}

	/** The organization's medicine and supply services (what an item can be sold as). */
	listServiceOptions(tx: ClinicalTx, organizationId: string): Promise<ServiceLinkRow[]> {
		return tx.serviceItem.findMany({
			where: { organizationId, category: { in: ['MEDICINE', 'SUPPLY', 'VACCINE'] } },
			select: { id: true, code: true, name: true, category: true, inventoryItemId: true, isActive: true },
			orderBy: { name: 'asc' },
		});
	}

	findService(tx: ClinicalTx, id: string): Promise<(ServiceLinkRow & { organizationId: string }) | null> {
		return tx.serviceItem.findUnique({
			where: { id },
			select: {
				id: true,
				organizationId: true,
				code: true,
				name: true,
				category: true,
				inventoryItemId: true,
				isActive: true,
			},
		});
	}

	findServiceForItem(tx: ClinicalTx, itemId: string): Promise<{ id: string; code: string } | null> {
		return tx.serviceItem.findUnique({ where: { inventoryItemId: itemId }, select: { id: true, code: true } });
	}

	/** Sets only the inventory link of a catalog service (Settings → Services owns the rest of the row). */
	async setServiceLink(tx: ClinicalTx, serviceItemId: string, itemId: string | null): Promise<void> {
		await tx.serviceItem.update({ where: { id: serviceItemId }, data: { inventoryItemId: itemId } });
	}
}
