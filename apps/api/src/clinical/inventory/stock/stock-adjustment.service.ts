import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import type { StockMovement, StockMovementType } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { AdjustmentDirection } from '../inventory.enums.js';
import { LotMismatchError, LotNotExpiredError } from '../inventory.errors.js';
import { InventoryItemService } from '../items/inventory-item.service.js';
import type {
	AdjustStockInput,
	DisposeExpiredStockInput,
	RecordConsumptionInput,
	RecordDamagedStockInput,
} from './dto/stock.input.js';
import { itemDisplayName, type LotRow, type StockMovementModel, toMovement } from './models/stock.model.js';
import { StockRepository } from './stock.repository.js';
import { StockLedgerService } from './stock-ledger.service.js';
import { dateOnly, isExpired, manilaToday } from './stock-rules.js';

/**
 * The explicit stock changes outside receiving and dispensing, one function each (DESIGN.md §5.5): a count
 * adjustment in or out with its reason, disposing of an expired lot, stock lost to damage, and supplies used on a
 * visit (CONSUMPTION, first expiry first out). Each goes through the ledger and writes its audit row in the same
 * transaction, as the user.
 */
@Injectable()
export class StockAdjustmentService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly stock: StockRepository,
		private readonly ledger: StockLedgerService,
		private readonly items: InventoryItemService,
		private readonly audit: AuditService,
	) {}

	adjust(actor: ClinicActor, input: AdjustStockInput): Promise<StockMovementModel> {
		const type: StockMovementType = input.direction === AdjustmentDirection.IN ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
		return this.onLot(actor, input.lotId, 'stock.adjust', () => ({
			type,
			quantity: input.quantity,
			reason: input.reason.trim(),
		}));
	}

	disposeExpired(actor: ClinicActor, input: DisposeExpiredStockInput): Promise<StockMovementModel> {
		return this.onLot(actor, input.lotId, 'stock.dispose_expired', (lot) => {
			if (!isExpired(dateOnly(lot.expiryDate), manilaToday())) {
				throw new LotNotExpiredError(lot.lotNo);
			}
			return {
				type: 'EXPIRED_DISPOSAL',
				quantity: input.quantity ?? lot.quantityOnHand.toNumber(),
				reason: text(input.reason) ?? `Expired ${dateOnly(lot.expiryDate)}`,
			};
		});
	}

	recordDamaged(actor: ClinicActor, input: RecordDamagedStockInput): Promise<StockMovementModel> {
		return this.onLot(actor, input.lotId, 'stock.damaged', () => ({
			type: 'DAMAGED',
			quantity: input.quantity,
			reason: input.reason.trim(),
		}));
	}

	/**
	 * Supplies used on a visit of the clinic. The visit is found by its number as system work (the stock room needn't
	 * see the chart); the movements and the audit row naming the patient are written as the user.
	 */
	async recordConsumption(actor: ClinicActor, input: RecordConsumptionInput): Promise<StockMovementModel[]> {
		const encounterNo = input.encounterNo.trim().toUpperCase();
		const encounter = await this.db.asSystem((tx) =>
			this.stock.findEncounterAtClinic(tx, actor.clinicId, encounterNo),
		);
		if (!encounter) {
			throw new EntityNotFoundError('Encounter', encounterNo);
		}
		const reason = text(input.reason);
		return this.db.asUser(actor.userId, async (tx) => {
			const rows: StockMovement[] = [];
			for (const line of input.lines) {
				const item = await this.items.require(tx, actor, line.itemId);
				rows.push(
					...(await this.ledger.take(tx, {
						clinicId: actor.clinicId,
						itemId: item.id,
						itemName: itemDisplayName(item),
						lotId: line.lotId ?? null,
						type: 'CONSUMPTION',
						quantity: line.quantity,
						encounterId: encounter.id,
						reason,
						performedById: actor.userId,
					})),
				);
			}
			await this.audit.created(tx, {
				event: 'stock.consumption',
				entityType: 'StockMovement',
				entityId: rows[0]?.id,
				userId: actor.userId,
				patientId: encounter.patientId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: {
					after: {
						encounterNo: encounter.encounterNo,
						movements: rows.map((row) => `${row.itemId} ${row.quantity.toString()}`),
					},
				},
				reason,
			});
			return this.models(tx, rows);
		});
	}

	/** One movement on one lot of the clinic, audited under `event`. */
	private onLot(
		actor: ClinicActor,
		lotId: string,
		event: string,
		build: (lot: LotRow) => { type: StockMovementType; quantity: number; reason: string },
	): Promise<StockMovementModel> {
		return this.db.asUser(actor.userId, async (tx) => {
			const lot = await this.stock.findLot(tx, lotId);
			if (!lot) {
				throw new EntityNotFoundError('InventoryLot', lotId);
			}
			if (lot.clinicId !== actor.clinicId) {
				throw new LotMismatchError(lot.lotNo);
			}
			const { type, quantity, reason } = build(lot);
			const row = await this.ledger.post(tx, {
				clinicId: actor.clinicId,
				itemId: lot.itemId,
				lotId: lot.id,
				type,
				quantity,
				reason,
				performedById: actor.userId,
			});
			await this.audit.created(tx, {
				event,
				entityType: 'StockMovement',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: {
					after: {
						lotNo: lot.lotNo,
						type,
						quantity: row.quantity.toNumber(),
						balanceAfter: row.balanceAfter?.toNumber() ?? null,
					},
				},
				reason,
			});
			return (await this.models(tx, [row]))[0];
		});
	}

	private async models(tx: ClinicalTx, rows: readonly StockMovement[]): Promise<StockMovementModel[]> {
		const full = await this.stock.findMovements(
			tx,
			rows.map((row) => row.id),
		);
		const names = await this.stock.userNames(
			tx,
			full.flatMap((row) => row.performedById ?? []),
		);
		return full.map((row) => toMovement(row, names));
	}
}
