import { Injectable } from '@nestjs/common';

import type { TaxType } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { itemDisplayName } from '../stock/models/stock.model.js';
import { round2 } from '../stock/stock-rules.js';
import { type ChargeMovementRow, InventoryBillingRepository } from './inventory-billing.repository.js';

/** One billable line of what the pharmacy dispensed on a visit (per item and price). */
export interface DispensedCharge {
	inventoryItemId: string;
	/** The catalog service that sells the item (`service_items.inventory_item_id`), when one is linked. */
	serviceItemId: string | null;
	/** The item, generic name first (RA 6675), e.g. "Amoxicillin 500 mg capsule (Amoxil)". */
	description: string;
	/** Net quantity dispensed (returns from the patient taken off). */
	quantity: number;
	/**
	 * The clinic's price of the linked service, else its default price, else the item's selling price, else 0
	 * (VAT-inclusive where VATABLE, as invoice lines are).
	 */
	unitPrice: number;
	/** The linked service's tax type, else the item's. */
	taxType: TaxType;
	/** The DISPENSE / RETURN_FROM_PATIENT ledger rows behind the line. */
	stockMovementIds: string[];
	prescriptionItemIds: string[];
}

/** What is billed: dispensing, less what the patient returned. */
const BILLED_TYPES = ['DISPENSE', 'RETURN_FROM_PATIENT'] as const;

/**
 * The billing hook of pharmacy (for the cashier's invoices): what was dispensed on a visit, priced from the catalog.
 * Read-only, on the caller's transaction (row-level security as the cashier: the visit's clinic's ledger). The
 * cashier decides what goes on the invoice; nothing here marks a line billed (the ledger is append-only).
 */
@Injectable()
export class InventoryBillingService {
	constructor(private readonly repository: InventoryBillingRepository) {}

	/** The visit's dispensed medicines and supplies as invoice lines, in the order first dispensed. */
	async dispensedChargesFor(tx: ClinicalTx, encounterId: string): Promise<DispensedCharge[]> {
		return toCharges(await this.repository.listForEncounter(tx, encounterId, BILLED_TYPES));
	}
}

/** Groups the movements per item and price; drops items whose net quantity is nothing. */
export function toCharges(rows: readonly ChargeMovementRow[]): DispensedCharge[] {
	const lines = new Map<string, DispensedCharge>();
	for (const row of rows) {
		const { price, taxType, serviceItemId } = priceOf(row);
		const key = `${row.itemId}:${price}`;
		const line = lines.get(key) ?? {
			inventoryItemId: row.itemId,
			serviceItemId,
			description: itemDisplayName(row.item),
			quantity: 0,
			unitPrice: price,
			taxType,
			stockMovementIds: [],
			prescriptionItemIds: [],
		};
		// DISPENSE rows are negative (out of stock), returns positive: the patient was given the opposite.
		line.quantity = round2(line.quantity - row.quantity.toNumber());
		line.stockMovementIds.push(row.id);
		if (row.prescriptionItemId && !line.prescriptionItemIds.includes(row.prescriptionItemId)) {
			line.prescriptionItemIds.push(row.prescriptionItemId);
		}
		lines.set(key, line);
	}
	return [...lines.values()].filter((line) => line.quantity > 0);
}

function priceOf(row: ChargeMovementRow): { price: number; taxType: TaxType; serviceItemId: string | null } {
	const service = row.item.serviceItem?.isActive ? row.item.serviceItem : null;
	if (service) {
		const clinicPrice = service.clinicPrices.find((price) => price.clinicId === row.clinicId);
		return {
			price: (clinicPrice?.price ?? service.defaultPrice).toNumber(),
			taxType: service.taxType,
			serviceItemId: service.id,
		};
	}
	return { price: row.item.sellingPrice?.toNumber() ?? 0, taxType: row.item.taxType, serviceItemId: null };
}
