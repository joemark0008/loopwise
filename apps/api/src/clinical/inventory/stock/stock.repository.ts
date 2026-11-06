import { Injectable } from '@nestjs/common';

import type { InventoryLot, Prisma, StockMovement, StockMovementType } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { LOT_INCLUDE, type LotRow, MOVEMENT_INCLUDE, type MovementRow } from './models/stock.model.js';

/**
 * Lots (`inventory_lots`) and the stock ledger (`stock_movements`, append-only), reached through the clinic
 * (row-level security). Every method takes the caller's transaction; writes go through `StockLedgerService` only.
 */
@Injectable()
export class StockRepository {
	/**
	 * Serializes stock changes of one item at one clinic until the transaction ends (a transaction-level advisory
	 * lock), so each movement's `balance_after` and the lots' quantities stay in step under concurrent writers.
	 */
	async lockItem(tx: ClinicalTx, clinicId: string, itemId: string): Promise<void> {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`stock:${clinicId}:${itemId}`}, 0))`;
	}

	findLot(tx: ClinicalTx, id: string): Promise<LotRow | null> {
		return tx.inventoryLot.findUnique({ where: { id }, include: LOT_INCLUDE });
	}

	findLotByNo(tx: ClinicalTx, itemId: string, clinicId: string, lotNo: string): Promise<InventoryLot | null> {
		return tx.inventoryLot.findUnique({ where: { itemId_clinicId_lotNo: { itemId, clinicId, lotNo } } });
	}

	createLot(tx: ClinicalTx, data: Prisma.InventoryLotUncheckedCreateInput): Promise<InventoryLot> {
		return tx.inventoryLot.create({ data });
	}

	updateLot(tx: ClinicalTx, id: string, data: Prisma.InventoryLotUncheckedUpdateInput): Promise<InventoryLot> {
		return tx.inventoryLot.update({ where: { id }, data });
	}

	/** The item's lots at the clinic (with stock only unless `includeEmpty`), earliest expiry first. */
	listLots(tx: ClinicalTx, clinicId: string, itemIds: readonly string[], includeEmpty = false): Promise<LotRow[]> {
		return tx.inventoryLot.findMany({
			where: { clinicId, itemId: { in: [...itemIds] }, ...(includeEmpty ? {} : { quantityOnHand: { gt: 0 } }) },
			include: LOT_INCLUDE,
			orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
		});
	}

	/** Every lot of the clinic that still holds stock, for the alerts. */
	listLotsWithStock(tx: ClinicalTx, clinicId: string): Promise<LotRow[]> {
		return tx.inventoryLot.findMany({
			where: { clinicId, quantityOnHand: { gt: 0 } },
			include: LOT_INCLUDE,
			orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }],
		});
	}

	/** The item's stock on hand at the clinic, every lot. */
	async itemBalance(tx: ClinicalTx, clinicId: string, itemId: string): Promise<number> {
		const sum = await tx.inventoryLot.aggregate({ where: { clinicId, itemId }, _sum: { quantityOnHand: true } });
		return sum._sum.quantityOnHand?.toNumber() ?? 0;
	}

	createMovement(tx: ClinicalTx, data: Prisma.StockMovementUncheckedCreateInput): Promise<StockMovement> {
		return tx.stockMovement.create({ data });
	}

	findMovements(tx: ClinicalTx, ids: readonly string[]): Promise<MovementRow[]> {
		return tx.stockMovement.findMany({
			where: { id: { in: [...ids] } },
			include: MOVEMENT_INCLUDE,
			orderBy: [{ performedAt: 'asc' }, { id: 'asc' }],
		});
	}

	/** The item's ledger at the clinic, newest first. */
	listMovements(tx: ClinicalTx, clinicId: string, itemId: string, limit: number): Promise<MovementRow[]> {
		return tx.stockMovement.findMany({
			where: { clinicId, itemId },
			include: MOVEMENT_INCLUDE,
			orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
			take: limit,
		});
	}

	/** Display names of the staff who made movements. */
	async userNames(tx: ClinicalTx, ids: readonly string[]): Promise<Map<string, string>> {
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return new Map();
		}
		const users = await tx.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
		return new Map(users.map((user) => [user.id, user.name]));
	}

	/** The movements of a visit of the given types (dispensed medicines, supplies used). */
	listForEncounter(tx: ClinicalTx, encounterId: string, types: readonly StockMovementType[]): Promise<MovementRow[]> {
		return tx.stockMovement.findMany({
			where: { encounterId, type: { in: [...types] } },
			include: MOVEMENT_INCLUDE,
			orderBy: [{ performedAt: 'asc' }, { id: 'asc' }],
		});
	}
}
