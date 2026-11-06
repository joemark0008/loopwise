import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	InvalidInventoryInputError,
	InventorySkuTakenError,
	ServiceItemAlreadyLinkedError,
} from '../inventory.errors.js';
import { manilaToday } from '../stock/stock-rules.js';
import type { SaveInventoryItemInput, SetInventoryServiceLinkInput } from './dto/inventory-item.input.js';
import { InventoryItemRepository, type ItemFilter } from './inventory-item.repository.js';
import { type InventoryItemModel, type InventoryItemRow, toInventoryItem } from './models/inventory-item.model.js';
import type { InventoryServiceOption } from './models/inventory-service-option.model.js';

/** Categories that are drugs: a generic name is required (RA 6675). */
const DRUG_CATEGORIES = new Set<string>(['MEDICINE', 'VACCINE']);

/**
 * The organization's inventory master (Pharmacy → Items): SKU, barcode, generic and brand names, strength and form,
 * FDA CPR number, Rx-only, dangerous drug (RA 9165), antimicrobial, PNF, storage, unit and pack, tax type, cost, price
 * and reorder level; and the link to the catalog service that sells the item (Settings → Services owns the service,
 * this sets only its `inventory_item_id`). Read by the pharmacy and stock room, written by the stock room and admins,
 * as the user (row-level security: the organization's staff). Every change is audited.
 */
@Injectable()
export class InventoryItemService {
	private readonly logger = new Logger(InventoryItemService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly items: InventoryItemRepository,
		private readonly audit: AuditService,
	) {}

	list(actor: ClinicActor, filter: ItemFilter): Promise<InventoryItemModel[]> {
		const today = manilaToday();
		return this.db.asUser(actor.userId, async (tx) =>
			(await this.items.list(tx, actor.organizationId, actor.clinicId, filter)).map((row) =>
				toInventoryItem(row, today),
			),
		);
	}

	get(actor: ClinicActor, id: string): Promise<InventoryItemModel> {
		return this.db.asUser(actor.userId, async (tx) =>
			toInventoryItem(await this.require(tx, actor, id), manilaToday()),
		);
	}

	/** Adds an item, or changes one (`input.id`). */
	save(actor: ClinicActor, input: SaveInventoryItemInput): Promise<InventoryItemModel> {
		const data = fields(input);
		return this.db.asUser(actor.userId, async (tx) => {
			const before = input.id ? await this.require(tx, actor, input.id) : null;
			const sameSku = await this.items.findBySku(tx, actor.organizationId, data.sku);
			if (sameSku && sameSku.id !== before?.id) {
				throw new InventorySkuTakenError(data.sku);
			}
			const row = before
				? await this.items.update(tx, before.id, data, actor.clinicId)
				: await this.items.create(tx, { ...data, organizationId: actor.organizationId }, actor.clinicId);
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: before ? 'inventory_item.update' : 'inventory_item.create',
				entityType: 'InventoryItem',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: before
					? auditChanges(snapshot(before), snapshot(row))
					: { after: auditSnapshot(snapshot(row)) },
			});
			this.logger.log(`${before ? 'Updated' : 'Added'} inventory item ${row.sku}`);
			return toInventoryItem(row, manilaToday());
		});
	}

	/** The medicine, supply and vaccine services an item can be sold as, with the item each already sells. */
	serviceOptions(actor: ClinicActor): Promise<InventoryServiceOption[]> {
		return this.db.asUser(actor.userId, async (tx) =>
			(await this.items.listServiceOptions(tx, actor.organizationId)).map((service) => ({
				id: service.id,
				code: service.code,
				name: service.name,
				linkedItemId: service.inventoryItemId,
				isActive: service.isActive,
			})),
		);
	}

	/** Links the item to the service that sells it (one item per service), or unlinks it. */
	setServiceLink(actor: ClinicActor, input: SetInventoryServiceLinkInput): Promise<InventoryItemModel> {
		return this.db.asUser(actor.userId, async (tx) => {
			const item = await this.require(tx, actor, input.itemId);
			const current = await this.items.findServiceForItem(tx, item.id);
			const target = input.serviceItemId ? await this.items.findService(tx, input.serviceItemId) : null;
			if (input.serviceItemId && (!target || target.organizationId !== actor.organizationId)) {
				throw new EntityNotFoundError('ServiceItem', input.serviceItemId);
			}
			if (target?.inventoryItemId && target.inventoryItemId !== item.id) {
				throw new ServiceItemAlreadyLinkedError(target.code);
			}
			if (current && current.id !== target?.id) {
				await this.items.setServiceLink(tx, current.id, null);
			}
			if (target && target.inventoryItemId !== item.id) {
				await this.items.setServiceLink(tx, target.id, item.id);
			}
			await this.audit.updated(tx, {
				event: 'inventory_item.service_link',
				entityType: 'InventoryItem',
				entityId: item.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: auditChanges({ serviceItem: current?.code ?? null }, { serviceItem: target?.code ?? null }),
			});
			return toInventoryItem(await this.require(tx, actor, item.id), manilaToday());
		});
	}

	/** An item of the actor's organization (a hidden or foreign one reads as not found). */
	async require(tx: ClinicalTx, actor: ClinicActor, id: string): Promise<InventoryItemRow> {
		const row = await this.items.find(tx, id, actor.clinicId);
		if (!row || row.organizationId !== actor.organizationId) {
			throw new EntityNotFoundError('InventoryItem', id);
		}
		return row;
	}
}

function fields(input: SaveInventoryItemInput) {
	const genericName = text(input.genericName);
	if (DRUG_CATEGORIES.has(input.category) && !genericName) {
		throw new InvalidInventoryInputError('A medicine or vaccine needs its generic name (RA 6675).', 'genericName');
	}
	return {
		sku: input.sku.trim().toUpperCase(),
		barcode: text(input.barcode),
		name: input.name.trim(),
		category: input.category,
		genericName,
		brandName: text(input.brandName),
		strength: text(input.strength),
		dosageForm: text(input.dosageForm),
		manufacturer: text(input.manufacturer),
		fdaCprNo: text(input.fdaCprNo),
		isRxOnly: input.isRxOnly || input.isDangerousDrug,
		isDangerousDrug: input.isDangerousDrug,
		isAntimicrobial: input.isAntimicrobial,
		isPnf: input.isPnf,
		storageCondition: text(input.storageCondition),
		unitOfMeasure: input.unitOfMeasure.trim(),
		packSize: input.packSize ?? null,
		taxType: input.taxType,
		defaultCost: input.defaultCost ?? null,
		sellingPrice: input.sellingPrice ?? null,
		reorderLevel: input.reorderLevel ?? null,
		isActive: input.isActive,
	};
}

function snapshot(row: InventoryItemRow): Record<string, unknown> {
	return {
		sku: row.sku,
		name: row.name,
		category: row.category,
		genericName: row.genericName,
		brandName: row.brandName,
		strength: row.strength,
		fdaCprNo: row.fdaCprNo,
		isRxOnly: row.isRxOnly,
		isDangerousDrug: row.isDangerousDrug,
		isAntimicrobial: row.isAntimicrobial,
		isPnf: row.isPnf,
		unitOfMeasure: row.unitOfMeasure,
		taxType: row.taxType,
		defaultCost: row.defaultCost?.toNumber() ?? null,
		sellingPrice: row.sellingPrice?.toNumber() ?? null,
		reorderLevel: row.reorderLevel?.toNumber() ?? null,
		isActive: row.isActive,
	};
}
