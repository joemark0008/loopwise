import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { InventoryAlertKind, StockMovementType } from '../../inventory.enums.js';
import { dateOnly, daysUntil, lotAlert } from '../stock-rules.js';

@ObjectType({ description: 'Stock of one lot of an item at a clinic (`inventory_lots`).' })
export class InventoryLotModel {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	itemId: string;

	@Field({ description: 'The item, generic name first (RA 6675).' })
	itemName: string;

	@Field()
	lotNo: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	expiryDate: string | null;

	@Field(() => Int, { nullable: true, description: 'Days to expiry from today (Manila); negative once past.' })
	daysToExpiry: number | null;

	@Field(() => InventoryAlertKind, { nullable: true, description: 'EXPIRED or EXPIRING (within 90 days).' })
	alert: InventoryAlertKind | null;

	@Field(() => Float)
	quantityOnHand: number;

	@Field(() => Float, { nullable: true })
	unitCost: number | null;

	@Field(() => String, { nullable: true })
	supplierName: string | null;

	@Field()
	receivedAt: Date;
}

@ObjectType({ description: 'One row of the stock ledger (`stock_movements`): signed quantity, balance after.' })
export class StockMovementModel {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	itemId: string;

	@Field()
	itemName: string;

	@Field(() => StockMovementType)
	type: StockMovementType;

	@Field(() => Float, { description: 'Signed: + into stock, − out of it.' })
	quantity: number;

	@Field(() => Float, { nullable: true })
	unitCost: number | null;

	@Field(() => Float, {
		nullable: true,
		description: "The item's stock on hand at the clinic (every lot) right after this row.",
	})
	balanceAfter: number | null;

	@Field(() => ID, { nullable: true })
	lotId: string | null;

	@Field(() => String, { nullable: true })
	lotNo: string | null;

	@Field(() => String, { nullable: true })
	expiryDate: string | null;

	@Field(() => String, { nullable: true })
	reason: string | null;

	@Field(() => ID, { nullable: true })
	encounterId: string | null;

	@Field(() => ID, { nullable: true })
	prescriptionItemId: string | null;

	@Field(() => ID, { nullable: true })
	stockReceiptId: string | null;

	@Field(() => String, { nullable: true, description: 'The delivery it came with (RECEIPT).' })
	receiptNo: string | null;

	@Field(() => String, { nullable: true, description: 'The prescription it was dispensed against, when visible.' })
	rxNo: string | null;

	@Field(() => String, { nullable: true })
	performedByName: string | null;

	@Field()
	performedAt: Date;
}

export const LOT_INCLUDE = {
	item: { select: { name: true, genericName: true, brandName: true } },
	supplier: { select: { name: true } },
} satisfies Prisma.InventoryLotInclude;

export type LotRow = Prisma.InventoryLotGetPayload<{ include: typeof LOT_INCLUDE }>;

export const MOVEMENT_INCLUDE = {
	item: { select: { name: true, genericName: true, brandName: true } },
	lot: { select: { lotNo: true, expiryDate: true } },
	stockReceipt: { select: { receiptNo: true } },
	prescriptionItem: { select: { prescription: { select: { rxNo: true } } } },
} satisfies Prisma.StockMovementInclude;

export type MovementRow = Prisma.StockMovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

/** "Amoxicillin 500 mg capsule (Amoxil)": the generic name first (RA 6675), the brand after it. */
export function itemDisplayName(item: { name: string; genericName: string | null; brandName: string | null }): string {
	if (!item.genericName) {
		return item.name;
	}
	return item.brandName ? `${item.name} (${item.brandName})` : item.name;
}

export function toLot(row: LotRow, today: string): InventoryLotModel {
	const expiryDate = dateOnly(row.expiryDate);
	const quantityOnHand = row.quantityOnHand.toNumber();
	const alert = lotAlert({ expiryDate, quantityOnHand }, today);
	return {
		id: row.id,
		itemId: row.itemId,
		itemName: itemDisplayName(row.item),
		lotNo: row.lotNo,
		expiryDate,
		daysToExpiry: expiryDate ? daysUntil(expiryDate, today) : null,
		alert: alert ? InventoryAlertKind[alert] : null,
		quantityOnHand,
		unitCost: row.unitCost?.toNumber() ?? null,
		supplierName: row.supplier?.name ?? null,
		receivedAt: row.receivedAt,
	};
}

export function toMovement(row: MovementRow, names: ReadonlyMap<string, string>): StockMovementModel {
	return {
		id: row.id,
		itemId: row.itemId,
		itemName: itemDisplayName(row.item),
		type: row.type,
		quantity: row.quantity.toNumber(),
		unitCost: row.unitCost?.toNumber() ?? null,
		balanceAfter: row.balanceAfter?.toNumber() ?? null,
		lotId: row.lotId,
		lotNo: row.lot?.lotNo ?? null,
		expiryDate: dateOnly(row.lot?.expiryDate ?? null),
		reason: row.reason,
		encounterId: row.encounterId,
		prescriptionItemId: row.prescriptionItemId,
		stockReceiptId: row.stockReceiptId,
		receiptNo: row.stockReceipt?.receiptNo ?? null,
		rxNo: row.prescriptionItem?.prescription.rxNo ?? null,
		performedByName: row.performedById ? (names.get(row.performedById) ?? null) : null,
		performedAt: row.performedAt,
	};
}
