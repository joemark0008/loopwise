import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { ServiceItemCodeTakenError, ServiceItemLinkTakenError } from '../billing.errors.js';
import type { SaveServiceItemInput, SetClinicServicePriceInput } from './dto/service-catalog.input.js';
import {
	type ServiceCatalogItem,
	type ServiceCatalogRow,
	type ServiceLinkOptions,
	toServiceCatalogItem,
} from './models/service-catalog.model.js';
import { ServiceCatalogRepository } from './service-catalog.repository.js';

/**
 * Settings → Clinic → Services (clinic admins): the organization's catalog of chargeable services (`service_items`:
 * code, category, default price, tax type, professional-fee share, the test or inventory item billed) and the selected
 * clinic's own prices (`clinic_service_prices`: price, HMO rate). Written as the user (the organization's staff own
 * the catalog under row-level security), except removing a clinic price, which users can't delete. Audited. Invoices
 * read the same prices through `ServiceItemService`.
 */
@Injectable()
export class ServiceCatalogService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly catalog: ServiceCatalogRepository,
		private readonly audit: AuditService,
	) {}

	list(actor: ClinicActor, includeInactive: boolean): Promise<ServiceCatalogItem[]> {
		return this.db.asUser(actor.userId, async (tx) =>
			(await this.catalog.list(tx, actor.organizationId, actor.clinicId, includeInactive)).map(
				toServiceCatalogItem,
			),
		);
	}

	linkOptions(actor: ClinicActor): Promise<ServiceLinkOptions> {
		return this.db.asUser(actor.userId, async (tx) => {
			const { diagnosticTests, inventoryItems } = await this.catalog.linkOptions(tx, actor.organizationId);
			return {
				diagnosticTests: diagnosticTests.map((test) => ({
					id: test.id,
					name: test.name,
					code: test.code,
					linkedServiceItemId: test.serviceItem?.id ?? null,
				})),
				inventoryItems: inventoryItems.map((item) => ({
					id: item.id,
					name: item.name,
					code: item.sku,
					linkedServiceItemId: item.serviceItem?.id ?? null,
				})),
			};
		});
	}

	/** Adds an item to the organization's catalog, or changes one (`input.id`). */
	save(actor: ClinicActor, input: SaveServiceItemInput): Promise<ServiceCatalogItem> {
		const code = input.code.trim().toUpperCase();
		const links = {
			diagnosticTestId: input.diagnosticTestId ?? null,
			inventoryItemId: input.inventoryItemId ?? null,
		};
		return this.db.asUser(actor.userId, async (tx) => {
			const before = input.id ? await this.requireItem(tx, actor, input.id) : null;
			const conflict = await this.catalog.findConflict(tx, actor.organizationId, before?.id ?? null, {
				code,
				...links,
			});
			if (conflict.code) {
				throw new ServiceItemCodeTakenError(code);
			}
			if (conflict.diagnosticTest) {
				throw new ServiceItemLinkTakenError('diagnosticTestId');
			}
			if (conflict.inventoryItem) {
				throw new ServiceItemLinkTakenError('inventoryItemId');
			}
			if (!(await this.catalog.ownsLinks(tx, actor.organizationId, links))) {
				throw new EntityNotFoundError(links.diagnosticTestId ? 'DiagnosticTest' : 'InventoryItem');
			}
			const data = {
				code,
				name: input.name.trim(),
				category: input.category,
				defaultPrice: input.defaultPrice,
				taxType: input.taxType,
				isPfShareable: input.isPfShareable,
				...links,
				isActive: input.isActive,
			};
			const row = before
				? await this.catalog.update(tx, before.id, data, actor.clinicId)
				: await this.catalog.create(tx, { ...data, organizationId: actor.organizationId }, actor.clinicId);
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: before ? 'service_item.update' : 'service_item.create',
				entityType: 'ServiceItem',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: before
					? auditChanges(catalogFields(before), catalogFields(row))
					: { after: auditSnapshot(catalogFields(row)) },
			});
			return toServiceCatalogItem(row);
		});
	}

	/** Sets the selected clinic's own price (and HMO rate) of an item. */
	setClinicPrice(actor: ClinicActor, input: SetClinicServicePriceInput): Promise<ServiceCatalogItem> {
		return this.db.asUser(actor.userId, async (tx) => {
			await this.requireItem(tx, actor, input.serviceItemId);
			const before = await this.catalog.findClinicPrice(tx, input.serviceItemId, actor.clinicId);
			const data = { price: input.price, hmoPrice: input.hmoPrice ?? null };
			await this.catalog.upsertClinicPrice(tx, input.serviceItemId, actor.clinicId, data);
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: 'clinic_service_price.set',
				entityType: 'ClinicServicePrice',
				entityId: input.serviceItemId,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: auditChanges(
					before ? { price: before.price.toNumber(), hmoPrice: before.hmoPrice?.toNumber() ?? null } : null,
					data,
				),
			});
			return toServiceCatalogItem(await this.requireItem(tx, actor, input.serviceItemId));
		});
	}

	/** Removes the selected clinic's own price of an item: the default price applies again. */
	removeClinicPrice(actor: ClinicActor, serviceItemId: string): Promise<ServiceCatalogItem> {
		return this.db.asSystem(async (tx) => {
			await this.requireItem(tx, actor, serviceItemId);
			const before = await this.catalog.findClinicPrice(tx, serviceItemId, actor.clinicId);
			if (before) {
				await this.catalog.deleteClinicPrice(tx, serviceItemId, actor.clinicId);
				await this.audit.record(tx, {
					action: 'DELETE',
					event: 'clinic_service_price.remove',
					entityType: 'ClinicServicePrice',
					entityId: serviceItemId,
					userId: actor.userId,
					organizationId: actor.organizationId,
					clinicId: actor.clinicId,
					changes: {
						before: { price: before.price.toNumber(), hmoPrice: before.hmoPrice?.toNumber() ?? null },
					},
				});
			}
			return toServiceCatalogItem(await this.requireItem(tx, actor, serviceItemId));
		});
	}

	/** An item of the actor's organization (a hidden or foreign one reads as not found). */
	private async requireItem(tx: ClinicalTx, actor: ClinicActor, id: string): Promise<ServiceCatalogRow> {
		const row = await this.catalog.find(tx, id, actor.clinicId);
		if (!row || row.organizationId !== actor.organizationId) {
			throw new EntityNotFoundError('ServiceItem', id);
		}
		return row;
	}
}

function catalogFields(row: ServiceCatalogRow): Record<string, unknown> {
	return {
		code: row.code,
		name: row.name,
		category: row.category,
		defaultPrice: row.defaultPrice.toNumber(),
		taxType: row.taxType,
		isPfShareable: row.isPfShareable,
		diagnosticTestId: row.diagnosticTestId,
		inventoryItemId: row.inventoryItemId,
		isActive: row.isActive,
	};
}
