import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import type { InventoryLot } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { ExpiredOnReceiptError, InvalidInventoryInputError, LotExpiryMismatchError } from '../inventory.errors.js';
import { InventoryItemService } from '../items/inventory-item.service.js';
import type { InventoryItemRow } from '../items/models/inventory-item.model.js';
import { StockRepository } from '../stock/stock.repository.js';
import { StockLedgerService } from '../stock/stock-ledger.service.js';
import { dateOnly, isCalendarDate, isExpired, manilaToday, round2 } from '../stock/stock-rules.js';
import { SupplierService } from '../suppliers/supplier.service.js';
import type { ReceiveStockInput, ReceiveStockLineInput } from './dto/stock-receipt.input.js';
import { type StockReceiptModel, toReceipt } from './models/stock-receipt.model.js';
import { StockReceiptRepository } from './stock-receipt.repository.js';

const EXPIRY_REQUIRED = new Set<string>(['MEDICINE', 'VACCINE', 'LAB_REAGENT']);

/**
 * Receiving (Pharmacy → Receive stock): a supplier's delivery (DR / invoice numbers) into the selected clinic. The
 * delivery gets the clinic's receiving number (`STOCK_RECEIPT`, e.g. TAG-RR-2026-000001); each line creates its lot
 * (lot number, expiry, unit cost) or adds to the same lot already on file, and writes a RECEIPT movement through the
 * ledger. An expired lot is refused, and so is a lot number on file with another expiry. One transaction, audited.
 */
@Injectable()
export class StockReceiptService {
	private readonly logger = new Logger(StockReceiptService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly receipts: StockReceiptRepository,
		private readonly stock: StockRepository,
		private readonly ledger: StockLedgerService,
		private readonly items: InventoryItemService,
		private readonly suppliers: SupplierService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
	) {}

	list(actor: ClinicActor, limit: number): Promise<StockReceiptModel[]> {
		return this.db.asUser(actor.userId, async (tx) => {
			const rows = await this.receipts.listRecent(tx, actor.clinicId, limit);
			const names = await this.stock.userNames(
				tx,
				rows.flatMap((row) => row.receivedById ?? []),
			);
			return rows.map((row) => toReceipt(row, names));
		});
	}

	receive(actor: ClinicActor, input: ReceiveStockInput): Promise<StockReceiptModel> {
		const today = manilaToday();
		return this.db.asUser(actor.userId, async (tx) => {
			const supplier = await this.suppliers.require(tx, actor, input.supplierId);
			const receiptNo = await this.sequences.next(
				tx,
				{ id: actor.clinicId, code: actor.clinicCode },
				'STOCK_RECEIPT',
			);
			const receipt = await this.receipts.create(tx, {
				clinicId: actor.clinicId,
				supplierId: supplier.id,
				receiptNo,
				deliveryReceiptNo: text(input.deliveryReceiptNo),
				supplierInvoiceNo: text(input.supplierInvoiceNo),
				remarks: text(input.remarks),
				receivedById: actor.userId,
			});
			let total = 0;
			for (const line of input.lines) {
				const item = await this.items.require(tx, actor, line.itemId);
				const lot = await this.lotFor(tx, actor, item, supplier.id, line, today);
				await this.receipts.addLine(tx, {
					receiptId: receipt.id,
					itemId: item.id,
					lotId: lot.id,
					lotNo: lot.lotNo,
					expiryDate: lot.expiryDate,
					quantity: line.quantity,
					unitCost: line.unitCost,
				});
				await this.ledger.post(tx, {
					clinicId: actor.clinicId,
					itemId: item.id,
					lotId: lot.id,
					type: 'RECEIPT',
					quantity: line.quantity,
					unitCost: line.unitCost,
					stockReceiptId: receipt.id,
					performedById: actor.userId,
				});
				total = round2(total + line.quantity * line.unitCost);
			}
			await this.receipts.setTotal(tx, receipt.id, total);
			const row = await this.receipts.find(tx, receipt.id);
			if (!row) {
				throw new EntityNotFoundError('StockReceipt', receipt.id);
			}
			await this.audit.created(tx, {
				event: 'stock_receipt.create',
				entityType: 'StockReceipt',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: {
					after: {
						receiptNo,
						supplier: supplier.name,
						deliveryReceiptNo: row.deliveryReceiptNo,
						supplierInvoiceNo: row.supplierInvoiceNo,
						totalCost: total,
						lines: row.items.map((item) => `${item.lotNo} × ${item.quantity.toString()}`),
					},
				},
			});
			this.logger.log(`Received ${receiptNo} (${input.lines.length} lines) at clinic ${actor.clinicId}`);
			return toReceipt(row, await this.stock.userNames(tx, [actor.userId]));
		});
	}

	/** The lot the line goes into: the same lot number on file (same expiry), else a new lot with no stock yet. */
	private async lotFor(
		tx: ClinicalTx,
		actor: ClinicActor,
		item: InventoryItemRow,
		supplierId: string,
		line: ReceiveStockLineInput,
		today: string,
	): Promise<InventoryLot> {
		const lotNo = line.lotNo.trim().toUpperCase();
		const expiry = line.expiryDate?.trim() || null;
		if (expiry && !isCalendarDate(expiry)) {
			throw new InvalidInventoryInputError(`"${expiry}" isn't a date: use YYYY-MM-DD.`, 'expiryDate');
		}
		if (!expiry && EXPIRY_REQUIRED.has(item.category)) {
			throw new InvalidInventoryInputError(`${item.name}: give the expiry date of lot ${lotNo}.`, 'expiryDate');
		}
		if (isExpired(expiry, today)) {
			throw new ExpiredOnReceiptError(lotNo, expiry ?? '');
		}
		const existing = await this.stock.findLotByNo(tx, item.id, actor.clinicId, lotNo);
		if (!existing) {
			return this.stock.createLot(tx, {
				itemId: item.id,
				clinicId: actor.clinicId,
				supplierId,
				lotNo,
				expiryDate: expiry ? new Date(`${expiry}T00:00:00Z`) : null,
				quantityOnHand: 0,
				unitCost: line.unitCost,
			});
		}
		const onFile = dateOnly(existing.expiryDate);
		if (onFile && expiry && onFile !== expiry) {
			throw new LotExpiryMismatchError(lotNo, onFile);
		}
		return this.stock.updateLot(tx, existing.id, {
			unitCost: line.unitCost,
			...(onFile ? {} : expiry ? { expiryDate: new Date(`${expiry}T00:00:00Z`) } : {}),
			...(existing.supplierId ? {} : { supplierId }),
		});
	}
}
