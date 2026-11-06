import type { TaxType } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** A medicine or supply dispensed at a visit, to bill. */
export interface DispensedCharge {
	/** The stock item; billed as the price list item linked to it (`service_items.inventory_item_id`). */
	inventoryItemId: string | null;
	/** The price list item, when the pharmacy already knows it. */
	serviceItemId?: string | null;
	description: string;
	quantity: number;
	/** The price charged; null = the linked item's clinic price. */
	unitPrice?: number | null;
	taxType?: TaxType | null;
}

/**
 * What billing needs from the pharmacy: the charges of the medicines dispensed at a visit (Pharmacy and inventory's
 * `InventoryBillingService.dispensedChargesFor(encounterId)`). Billing owns this port so it doesn't depend on the
 * inventory module; the pharmacy binds `DISPENSED_CHARGES` to its own service. Called inside billing's (RLS)
 * transaction, as the user.
 */
export interface DispensedChargesSource {
	dispensedChargesFor(encounterId: string, context: { userId: string; tx: ClinicalTx }): Promise<DispensedCharge[]>;
}

export const DISPENSED_CHARGES = Symbol('DISPENSED_CHARGES');

/** The default until the pharmacy provides its hook: nothing dispensed. */
@Injectable()
export class NoDispensedCharges implements DispensedChargesSource {
	dispensedChargesFor(): Promise<DispensedCharge[]> {
		return Promise.resolve([]);
	}
}
