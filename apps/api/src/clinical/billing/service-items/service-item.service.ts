import { type InvoiceLineDraft, isScPwdEligible } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import type { PricedLine } from '../invoices/invoice-totals.service.js';
import { type ServiceItemPrice, toServiceItemPrice } from './models/service-item.model.js';
import { ServiceItemRepository } from './service-item.repository.js';

export interface BillingClinic {
	id: string;
	organizationId: string;
}

/** A draft line resolved against the price list: its item (when any) sets the tax type and the category. */
export interface ResolvedLine extends PricedLine {
	item: ServiceItemPrice | null;
	/** The doctor the line names (from "Load charges"), checked by the invoice service. */
	practitionerId: string | null;
	/** The pharmacy ledger rows it bills. */
	stockMovementIds: string[];
}

/**
 * The organization's chargeable catalog (`ServiceItem`) at a clinic's prices (`ClinicServicePrice`, else the default
 * price). Lines that name a catalog item, by id or by its exact name or code, are billed as that item.
 */
@Injectable()
export class ServiceItemService {
	constructor(private readonly items: ServiceItemRepository) {}

	/** The clinic's price list: the organization's active items at the clinic's price. */
	async priceList(tx: ClinicalTx, clinic: BillingClinic): Promise<ServiceItemPrice[]> {
		return (await this.items.listActive(tx, clinic.organizationId, clinic.id)).map(toServiceItemPrice);
	}

	/**
	 * Matches each line to the catalog: by `serviceItemId` (refused when it isn't an active item of the organization),
	 * else by the item's name or code (case-insensitive), else a free-text line. A catalog item's tax type wins over
	 * the one sent; the price sent is kept (the desk may adjust it).
	 */
	async resolveLines(
		tx: ClinicalTx,
		clinic: BillingClinic,
		lines: readonly InvoiceLineDraft[],
	): Promise<ResolvedLine[]> {
		const catalog = await this.priceList(tx, clinic);
		const byId = new Map(catalog.map((item) => [item.id, item]));
		const byName = new Map<string, ServiceItemPrice>();
		for (const item of catalog) {
			byName.set(item.code.toLowerCase(), item);
			byName.set(item.name.toLowerCase(), item);
		}
		return lines.map((line) => {
			let item: ServiceItemPrice | null = null;
			if (line.serviceItemId) {
				item = byId.get(line.serviceItemId) ?? null;
				if (!item) {
					throw new EntityNotFoundError('ServiceItem', line.serviceItemId);
				}
			} else {
				item = byName.get(line.description.trim().toLowerCase()) ?? null;
			}
			return {
				item,
				serviceItemId: item?.id ?? null,
				description: line.description,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				taxType: item?.taxType ?? line.taxType,
				scPwdEligible: isScPwdEligible(item?.category),
				practitionerId: line.practitionerId ?? null,
				stockMovementIds: line.stockMovementIds,
			};
		});
	}
}
