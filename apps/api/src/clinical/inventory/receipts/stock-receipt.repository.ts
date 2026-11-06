import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { RECEIPT_INCLUDE, type ReceiptRow } from './models/stock-receipt.model.js';

/** Deliveries (`stock_receipts`, `stock_receipt_items`) of a clinic, under row-level security. */
@Injectable()
export class StockReceiptRepository {
	create(tx: ClinicalTx, data: Prisma.StockReceiptUncheckedCreateInput): Promise<{ id: string }> {
		return tx.stockReceipt.create({ data, select: { id: true } });
	}

	async addLine(tx: ClinicalTx, data: Prisma.StockReceiptItemUncheckedCreateInput): Promise<void> {
		await tx.stockReceiptItem.create({ data });
	}

	async setTotal(tx: ClinicalTx, id: string, totalCost: number): Promise<void> {
		await tx.stockReceipt.update({ where: { id }, data: { totalCost } });
	}

	find(tx: ClinicalTx, id: string): Promise<ReceiptRow | null> {
		return tx.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
	}

	listRecent(tx: ClinicalTx, clinicId: string, limit: number): Promise<ReceiptRow[]> {
		return tx.stockReceipt.findMany({
			where: { clinicId },
			include: RECEIPT_INCLUDE,
			orderBy: { receivedAt: 'desc' },
			take: limit,
		});
	}
}
