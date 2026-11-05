import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { SERVICE_ITEM_PRICE_INCLUDE, type ServiceItemPriceRow } from './models/service-item.model.js';

/** `service_items` with the clinic's `clinic_service_prices`. Runs inside the caller's (RLS) transaction. */
@Injectable()
export class ServiceItemRepository {
	/** The organization's active items, priced for the clinic, by category then name. */
	listActive(tx: ClinicalTx, organizationId: string, clinicId: string): Promise<ServiceItemPriceRow[]> {
		return tx.serviceItem.findMany({
			where: { organizationId, isActive: true },
			include: SERVICE_ITEM_PRICE_INCLUDE(clinicId),
			orderBy: [{ category: 'asc' }, { name: 'asc' }],
		});
	}

	/** The active items of the organization among `ids`. */
	findActiveByIds(
		tx: ClinicalTx,
		organizationId: string,
		clinicId: string,
		ids: readonly string[],
	): Promise<ServiceItemPriceRow[]> {
		return tx.serviceItem.findMany({
			where: { organizationId, isActive: true, id: { in: [...ids] } },
			include: SERVICE_ITEM_PRICE_INCLUDE(clinicId),
		});
	}
}
