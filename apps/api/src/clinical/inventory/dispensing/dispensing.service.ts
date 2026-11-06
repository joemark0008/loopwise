import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { parseSignatory } from '../../practitioners/models/document-signatory.model.js';
import { PrescriptionService } from '../../prescriptions/prescription.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import {
	DangerousDrugRxIncompleteError,
	NotEquivalentError,
	PrescriptionExpiredForDispenseError,
} from '../inventory.errors.js';
import { InventoryItemService } from '../items/inventory-item.service.js';
import { itemDisplayName } from '../stock/models/stock.model.js';
import { StockLedgerService } from '../stock/stock-ledger.service.js';
import { dateOnly, manilaToday } from '../stock/stock-rules.js';
import { DispenseQueueService } from './dispense-queue.service.js';
import { isPrescribedProduct, isSameGeneric, isSameStrength, s2Missing } from './dispense-rules.js';
import type { DispensePrescriptionInput } from './dto/dispense.input.js';
import type { DispenseQueueEntry } from './models/dispense.model.js';

/**
 * Dispensing an issued prescription, medicine by medicine (Pharmacy → Dispense). For each line the pharmacist picks
 * the stock item (the prescribed one or an equivalent generic of the same strength, RA 6675; another product is a
 * substitution, recorded on the movement and in the audit row), the lot (first expiry first out by default; never an
 * expired lot) and the quantity (at most what is left). A dangerous drug needs the S2 details on the Rx (RA 9165).
 * DISPENSE movements are linked to the prescription item and the visit, so the cashier bills them
 * (`InventoryBillingService`); `PrescriptionService.recordDispensed` moves `dispensed_qty` and the status. One
 * transaction, audited.
 */
@Injectable()
export class DispensingService {
	private readonly logger = new Logger(DispensingService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly queue: DispenseQueueService,
		private readonly items: InventoryItemService,
		private readonly ledger: StockLedgerService,
		private readonly prescriptions: PrescriptionService,
		private readonly audit: AuditService,
	) {}

	dispense(actor: ClinicActor, input: DispensePrescriptionInput): Promise<DispenseQueueEntry> {
		const today = manilaToday();
		return this.db.asUser(actor.userId, async (tx) => {
			const rx = await this.queue.requireRx(tx, actor, input.prescriptionId);
			const validUntil = dateOnly(rx.validUntil);
			if (validUntil && validUntil < today) {
				throw new PrescriptionExpiredForDispenseError(rx.rxNo, validUntil);
			}
			const prescriberS2 = parseSignatory(rx.signatory)?.s2LicenseNo ?? null;
			const recorded: { prescriptionItemId: string; quantity: number; inventoryItemId: string }[] = [];
			const summary: string[] = [];
			const substitutions: string[] = [];
			for (const line of input.lines) {
				const rxItem = rx.items.find((item) => item.id === line.prescriptionItemId);
				if (!rxItem) {
					throw new EntityNotFoundError('PrescriptionItem', line.prescriptionItemId);
				}
				const item = await this.items.require(tx, actor, line.itemId);
				const name = itemDisplayName(item);
				if (
					!isSameGeneric(rxItem.genericName, item.genericName) ||
					!isSameStrength(rxItem.strength, item.strength)
				) {
					throw new NotEquivalentError(`${rxItem.genericName} ${rxItem.strength ?? ''}`.trim(), name);
				}
				if (rx.isDangerousDrug || item.isDangerousDrug) {
					const missing = s2Missing({
						s2FormSerialNo: rx.s2FormSerialNo,
						prescriberS2LicenseNo: prescriberS2,
						dangerousLines: [rxItem],
					});
					if (missing) {
						throw new DangerousDrugRxIncompleteError(missing);
					}
				}
				const substituted = !isPrescribedProduct(
					{ inventoryItemId: rxItem.inventoryItemId, brandName: rxItem.brandName },
					item,
				);
				const reason = substituted
					? `Substituted ${name} for ${rxItem.brandName ?? rxItem.genericName}` +
						(text(line.substitutionReason) ? `: ${text(line.substitutionReason)}` : '')
					: null;
				if (reason) {
					substitutions.push(reason);
				}
				const movements = await this.ledger.take(tx, {
					clinicId: actor.clinicId,
					itemId: item.id,
					itemName: name,
					lotId: line.lotId ?? null,
					type: 'DISPENSE',
					quantity: line.quantity,
					encounterId: rx.encounter.id,
					prescriptionItemId: rxItem.id,
					reason,
					performedById: actor.userId,
				});
				recorded.push({ prescriptionItemId: rxItem.id, quantity: line.quantity, inventoryItemId: item.id });
				summary.push(
					`${name} × ${line.quantity} (${movements.length} lot${movements.length === 1 ? '' : 's'})`,
				);
			}
			const after = await this.prescriptions.recordDispensed(tx, rx.id, recorded);
			await this.audit.updated(tx, {
				event: 'prescription.dispense',
				entityType: 'Prescription',
				entityId: rx.id,
				userId: actor.userId,
				patientId: rx.encounter.patient.id,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: {
					before: { status: rx.status },
					after: { status: after.status, rxNo: rx.rxNo, dispensed: summary },
				},
				reason: substitutions.length > 0 ? substitutions.join('; ') : null,
			});
			this.logger.log(`Dispensed ${rx.rxNo} (${summary.length} lines): ${after.status}`);
			return this.queue.load(tx, actor, rx.id);
		});
	}
}
