import { Injectable } from '@nestjs/common';

import type { ClinicServicePrice, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { SERVICE_CATALOG_INCLUDE, type ServiceCatalogRow } from './models/service-catalog.model.js';

/**
 * The catalog side of `service_items` and `clinic_service_prices` (Settings → Services), with the tests and inventory
 * items an item can bill. Every method takes the caller's transaction (row-level security: the organization's
 * catalog, the clinic's prices).
 */
@Injectable()
export class ServiceCatalogRepository {
	list(
		tx: ClinicalTx,
		organizationId: string,
		clinicId: string,
		includeInactive: boolean,
	): Promise<ServiceCatalogRow[]> {
		return tx.serviceItem.findMany({
			where: { organizationId, ...(includeInactive ? {} : { isActive: true }) },
			include: SERVICE_CATALOG_INCLUDE(clinicId),
			orderBy: [{ category: 'asc' }, { name: 'asc' }],
		});
	}

	find(tx: ClinicalTx, id: string, clinicId: string): Promise<ServiceCatalogRow | null> {
		return tx.serviceItem.findUnique({ where: { id }, include: SERVICE_CATALOG_INCLUDE(clinicId) });
	}

	create(tx: ClinicalTx, data: Prisma.ServiceItemUncheckedCreateInput, clinicId: string): Promise<ServiceCatalogRow> {
		return tx.serviceItem.create({ data, include: SERVICE_CATALOG_INCLUDE(clinicId) });
	}

	update(
		tx: ClinicalTx,
		id: string,
		data: Prisma.ServiceItemUncheckedUpdateInput,
		clinicId: string,
	): Promise<ServiceCatalogRow> {
		return tx.serviceItem.update({ where: { id }, data, include: SERVICE_CATALOG_INCLUDE(clinicId) });
	}

	/** Another item of the organization with this code, or billing the same test or inventory item. */
	async findConflict(
		tx: ClinicalTx,
		organizationId: string,
		id: string | null,
		{
			code,
			diagnosticTestId,
			inventoryItemId,
		}: { code: string; diagnosticTestId: string | null; inventoryItemId: string | null },
	): Promise<{ code: boolean; diagnosticTest: boolean; inventoryItem: boolean }> {
		const others = await tx.serviceItem.findMany({
			where: {
				...(id ? { id: { not: id } } : {}),
				OR: [
					{ organizationId, code },
					...(diagnosticTestId ? [{ diagnosticTestId }] : []),
					...(inventoryItemId ? [{ inventoryItemId }] : []),
				],
			},
			select: { code: true, organizationId: true, diagnosticTestId: true, inventoryItemId: true },
		});
		return {
			code: others.some((other) => other.organizationId === organizationId && other.code === code),
			diagnosticTest: Boolean(diagnosticTestId) && others.some((o) => o.diagnosticTestId === diagnosticTestId),
			inventoryItem: Boolean(inventoryItemId) && others.some((o) => o.inventoryItemId === inventoryItemId),
		};
	}

	/** Whether the test / inventory item belongs to the organization. */
	async ownsLinks(
		tx: ClinicalTx,
		organizationId: string,
		{ diagnosticTestId, inventoryItemId }: { diagnosticTestId: string | null; inventoryItemId: string | null },
	): Promise<boolean> {
		const test = diagnosticTestId
			? await tx.diagnosticTest.findFirst({
					where: { id: diagnosticTestId, organizationId },
					select: { id: true },
				})
			: true;
		const item = inventoryItemId
			? await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, organizationId }, select: { id: true } })
			: true;
		return Boolean(test && item);
	}

	findClinicPrice(tx: ClinicalTx, serviceItemId: string, clinicId: string): Promise<ClinicServicePrice | null> {
		return tx.clinicServicePrice.findUnique({ where: { serviceItemId_clinicId: { serviceItemId, clinicId } } });
	}

	upsertClinicPrice(
		tx: ClinicalTx,
		serviceItemId: string,
		clinicId: string,
		data: { price: number; hmoPrice: number | null },
	): Promise<ClinicServicePrice> {
		return tx.clinicServicePrice.upsert({
			where: { serviceItemId_clinicId: { serviceItemId, clinicId } },
			create: { serviceItemId, clinicId, ...data },
			update: data,
		});
	}

	/** Removes the clinic's own price (system work: users have no DELETE on prices). */
	async deleteClinicPrice(tx: ClinicalTx, serviceItemId: string, clinicId: string): Promise<void> {
		await tx.clinicServicePrice.deleteMany({ where: { serviceItemId, clinicId } });
	}

	/** The organization's active tests and inventory items, with the item that already bills each. */
	async linkOptions(
		tx: ClinicalTx,
		organizationId: string,
	): Promise<{
		diagnosticTests: { id: string; name: string; code: string; serviceItem: { id: string } | null }[];
		inventoryItems: { id: string; name: string; sku: string; serviceItem: { id: string } | null }[];
	}> {
		const diagnosticTests = await tx.diagnosticTest.findMany({
			where: { organizationId, isActive: true },
			select: { id: true, name: true, code: true, serviceItem: { select: { id: true } } },
			orderBy: { name: 'asc' },
		});
		const inventoryItems = await tx.inventoryItem.findMany({
			where: { organizationId, isActive: true },
			select: { id: true, name: true, sku: true, serviceItem: { select: { id: true } } },
			orderBy: { name: 'asc' },
		});
		return { diagnosticTests, inventoryItems };
	}
}
