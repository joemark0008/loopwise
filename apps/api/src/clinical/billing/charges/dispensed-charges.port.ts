import type { TaxType } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** A medicine or supply dispensed at a visit, to bill (one line per item and price). */
export interface DispensedCharge {
	inventoryItemId: string | null;
	/** The price list item that sells it, when linked (`service_items.inventory_item_id`). */
	serviceItemId: string | null;
	description: string;
	/** Net quantity dispensed (returns from the patient taken off). */
	quantity: number;
	/** The price charged (VAT-inclusive where VATABLE). */
	unitPrice: number;
	taxType: TaxType;
	/** The ledger rows behind the line (`stock_movements`, append-only): kept on the invoice line. */
	stockMovementIds: string[];
}

/**
 * What billing needs from the pharmacy: the charges of the medicines dispensed at a visit, read on billing's (RLS)
 * transaction. `BillingModule` binds `DISPENSED_CHARGES` to Pharmacy's `InventoryBillingService`
 * (`dispensedChargesFor(tx, encounterId)`); tests bind a stub or `NoDispensedCharges`.
 */
export interface DispensedChargesSource {
	dispensedChargesFor(tx: ClinicalTx, encounterId: string): Promise<DispensedCharge[]>;
}

export const DISPENSED_CHARGES = Symbol('DISPENSED_CHARGES');

/** Nothing dispensed: for a billing set up without the pharmacy (tests). */
@Injectable()
export class NoDispensedCharges implements DispensedChargesSource {
	dispensedChargesFor(): Promise<DispensedCharge[]> {
		return Promise.resolve([]);
	}
}
