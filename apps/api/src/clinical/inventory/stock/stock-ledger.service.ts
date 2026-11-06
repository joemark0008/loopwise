import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { StockMovement, StockMovementType } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { ExpiredLotError, InsufficientStockError, LotMismatchError } from '../inventory.errors.js';
import { itemDisplayName, type LotRow } from './models/stock.model.js';
import { StockRepository } from './stock.repository.js';
import { dateOnly, isExpired, type LotPick, manilaToday, pickFefo, round2, usableQuantity } from './stock-rules.js';

/** Types that take stock out of a lot (negative quantities). */
const OUTGOING: ReadonlySet<StockMovementType> = new Set([
	'DISPENSE',
	'CONSUMPTION',
	'ADJUSTMENT_OUT',
	'TRANSFER_OUT',
	'RETURN_TO_SUPPLIER',
	'EXPIRED_DISPOSAL',
	'DAMAGED',
]);

/** Outgoing types that must never touch an expired lot. */
const NEEDS_UNEXPIRED: ReadonlySet<StockMovementType> = new Set(['DISPENSE', 'CONSUMPTION']);

/** One change of one lot. `quantity` is the amount moved (positive); the type sets the sign. */
export interface LotMovement {
	clinicId: string;
	itemId: string;
	lotId: string;
	type: StockMovementType;
	quantity: number;
	performedById: string;
	unitCost?: number | null;
	encounterId?: string | null;
	prescriptionItemId?: string | null;
	stockReceiptId?: string | null;
	reason?: string | null;
}

/**
 * The one writer of the stock ledger (DESIGN.md §5.5). Every quantity change is a signed `stock_movements` row with
 * the item's balance after it, and the lot's `quantity_on_hand` moves in the same transaction. Changes of an item at a
 * clinic are serialized (an advisory lock until the transaction ends), a lot never goes below zero (a check backs
 * it), and expired lots are never dispensed or used. The ledger is append-only (a trigger): a mistake is corrected by
 * another movement, never by editing one. Callers write their own audit row.
 */
@Injectable()
export class StockLedgerService {
	private readonly logger = new Logger(StockLedgerService.name);

	constructor(private readonly stock: StockRepository) {}

	/** Serializes changes of the item at the clinic for the rest of the transaction. */
	lock(tx: ClinicalTx, clinicId: string, itemId: string): Promise<void> {
		return this.stock.lockItem(tx, clinicId, itemId);
	}

	/** Posts one movement: moves the lot and appends the ledger row with the item's balance after it. */
	async post(tx: ClinicalTx, movement: LotMovement): Promise<StockMovement> {
		await this.stock.lockItem(tx, movement.clinicId, movement.itemId);
		const lot = await this.requireLot(tx, movement);
		const signed = OUTGOING.has(movement.type) ? -movement.quantity : movement.quantity;
		const onHand = lot.quantityOnHand.toNumber();
		if (NEEDS_UNEXPIRED.has(movement.type) && isExpired(dateOnly(lot.expiryDate), manilaToday())) {
			throw new ExpiredLotError(lot.lotNo, dateOnly(lot.expiryDate) ?? '');
		}
		if (onHand + signed < 0) {
			throw new InsufficientStockError(itemDisplayName(lot.item), onHand, movement.quantity);
		}
		await this.stock.updateLot(tx, lot.id, { quantityOnHand: round2(onHand + signed) });
		const balanceAfter = await this.stock.itemBalance(tx, movement.clinicId, movement.itemId);
		const row = await this.stock.createMovement(tx, {
			clinicId: movement.clinicId,
			itemId: movement.itemId,
			lotId: lot.id,
			type: movement.type,
			quantity: signed,
			unitCost: movement.unitCost ?? lot.unitCost,
			balanceAfter,
			encounterId: movement.encounterId ?? null,
			prescriptionItemId: movement.prescriptionItemId ?? null,
			stockReceiptId: movement.stockReceiptId ?? null,
			reason: movement.reason ?? null,
			performedById: movement.performedById,
		});
		this.logger.log(
			`${movement.type} ${signed} of item ${movement.itemId} lot ${lot.lotNo} at clinic ${movement.clinicId}: balance ${balanceAfter}`,
		);
		return row;
	}

	/**
	 * Takes `quantity` of the item out of the clinic's stock, from one chosen lot (`lotId`) or first expiry first out
	 * across the unexpired lots: one movement per lot taken from.
	 */
	async take(
		tx: ClinicalTx,
		movement: Omit<LotMovement, 'lotId'> & { lotId?: string | null; itemName: string },
	): Promise<StockMovement[]> {
		await this.stock.lockItem(tx, movement.clinicId, movement.itemId);
		const picks: LotPick[] = movement.lotId
			? [{ lotId: movement.lotId, lotNo: '', quantity: movement.quantity }]
			: await this.pickFefo(tx, movement.clinicId, movement.itemId, movement.quantity, movement.itemName);
		const rows: StockMovement[] = [];
		for (const pick of picks) {
			rows.push(await this.post(tx, { ...movement, lotId: pick.lotId, quantity: pick.quantity }));
		}
		return rows;
	}

	/** The FEFO picks for `quantity`, or the stock error with the unexpired quantity on hand. */
	private async pickFefo(
		tx: ClinicalTx,
		clinicId: string,
		itemId: string,
		quantity: number,
		itemName: string,
	): Promise<LotPick[]> {
		const today = manilaToday();
		const lots = (await this.stock.listLots(tx, clinicId, [itemId])).map((lot) => ({
			id: lot.id,
			lotNo: lot.lotNo,
			expiryDate: dateOnly(lot.expiryDate),
			quantityOnHand: lot.quantityOnHand.toNumber(),
			receivedAt: lot.receivedAt,
		}));
		const picks = pickFefo(lots, quantity, today);
		if (!picks) {
			throw new InsufficientStockError(itemName, usableQuantity(lots, today), quantity);
		}
		return picks;
	}

	private async requireLot(tx: ClinicalTx, movement: LotMovement): Promise<LotRow> {
		const lot = await this.stock.findLot(tx, movement.lotId);
		if (!lot) {
			throw new EntityNotFoundError('InventoryLot', movement.lotId);
		}
		if (lot.itemId !== movement.itemId || lot.clinicId !== movement.clinicId) {
			throw new LotMismatchError(lot.lotNo);
		}
		return lot;
	}
}
