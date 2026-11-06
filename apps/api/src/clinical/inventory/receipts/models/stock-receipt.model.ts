import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { itemDisplayName } from '../../stock/models/stock.model.js';
import { dateOnly } from '../../stock/stock-rules.js';

@ObjectType({ description: 'One lot received with a delivery.' })
export class StockReceiptLineModel {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	itemId: string;

	@Field()
	itemName: string;

	@Field(() => ID, { nullable: true })
	lotId: string | null;

	@Field()
	lotNo: string;

	@Field(() => String, { nullable: true })
	expiryDate: string | null;

	@Field(() => Float)
	quantity: number;

	@Field(() => Float)
	unitCost: number;
}

@ObjectType({ description: 'A delivery received from a supplier (`stock_receipts`).' })
export class StockReceiptModel {
	@Field(() => ID)
	id: string;

	@Field({ description: "The clinic's receiving number, e.g. TAG-RR-2026-000001." })
	receiptNo: string;

	@Field(() => ID)
	supplierId: string;

	@Field()
	supplierName: string;

	@Field(() => String, { nullable: true })
	deliveryReceiptNo: string | null;

	@Field(() => String, { nullable: true })
	supplierInvoiceNo: string | null;

	@Field()
	receivedAt: Date;

	@Field(() => String, { nullable: true })
	receivedByName: string | null;

	@Field(() => Float)
	totalCost: number;

	@Field(() => String, { nullable: true })
	remarks: string | null;

	@Field(() => [StockReceiptLineModel])
	lines: StockReceiptLineModel[];
}

export const RECEIPT_INCLUDE = {
	supplier: { select: { name: true } },
	items: {
		include: { item: { select: { name: true, genericName: true, brandName: true } } },
		orderBy: { id: 'asc' },
	},
} satisfies Prisma.StockReceiptInclude;

export type ReceiptRow = Prisma.StockReceiptGetPayload<{ include: typeof RECEIPT_INCLUDE }>;

export function toReceipt(row: ReceiptRow, names: ReadonlyMap<string, string>): StockReceiptModel {
	return {
		id: row.id,
		receiptNo: row.receiptNo,
		supplierId: row.supplierId,
		supplierName: row.supplier.name,
		deliveryReceiptNo: row.deliveryReceiptNo,
		supplierInvoiceNo: row.supplierInvoiceNo,
		receivedAt: row.receivedAt,
		receivedByName: row.receivedById ? (names.get(row.receivedById) ?? null) : null,
		totalCost: row.totalCost.toNumber(),
		remarks: row.remarks,
		lines: row.items.map((line) => ({
			id: line.id,
			itemId: line.itemId,
			itemName: itemDisplayName(line.item),
			lotId: line.lotId,
			lotNo: line.lotNo,
			expiryDate: dateOnly(line.expiryDate),
			quantity: line.quantity.toNumber(),
			unitCost: line.unitCost.toNumber(),
		})),
	};
}
