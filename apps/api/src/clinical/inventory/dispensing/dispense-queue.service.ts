import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { PrescriptionStatus } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { parseSignatory } from '../../practitioners/models/document-signatory.model.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { OtherClinicError } from '../inventory.errors.js';
import { InventoryItemRepository } from '../items/inventory-item.repository.js';
import { type InventoryItemRow, toInventoryItem } from '../items/models/inventory-item.model.js';
import { itemDisplayName, toLot } from '../stock/models/stock.model.js';
import { StockRepository } from '../stock/stock.repository.js';
import { dateOnly, fefoOrder, manilaToday } from '../stock/stock-rules.js';
import { isPrescribedProduct, isSameGeneric, isSameStrength, s2Missing } from './dispense-rules.js';
import { type DispenseRxRow, DispensingRepository } from './dispensing.repository.js';
import type { DispenseCandidate, DispenseQueueEntry } from './models/dispense.model.js';

const OPEN: readonly PrescriptionStatus[] = ['ACTIVE', 'PARTIALLY_DISPENSED'];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The pharmacy's dispense queue (Pharmacy → Dispense): the clinic's issued prescriptions still to dispense, oldest
 * first, and one prescription with the stock that can fill each medicine (the same generic and strength, RA 6675;
 * its unexpired lots first expiry first out). Read as the user (the pharmacy desk reaches issued prescriptions of its
 * clinic, `0002_inventory`); opening a prescription is audited as a view of the patient's record.
 */
@Injectable()
export class DispenseQueueService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly dispensing: DispensingRepository,
		private readonly items: InventoryItemRepository,
		private readonly stock: StockRepository,
		private readonly audit: AuditService,
	) {}

	queue(actor: ClinicActor, includeDone: boolean): Promise<DispenseQueueEntry[]> {
		return this.db.asUser(actor.userId, async (tx) => {
			const open = await this.dispensing.listQueue(tx, actor.clinicId, OPEN, new Date(Date.now() - 90 * DAY_MS));
			const done = includeDone
				? await this.dispensing.listQueue(tx, actor.clinicId, ['DISPENSED'], new Date(Date.now() - 7 * DAY_MS))
				: [];
			await this.audit.view(tx, {
				event: 'dispense_queue.list',
				entityType: 'Prescription',
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
			});
			return [...open, ...done].map((row) => toEntry(row, new Map()));
		});
	}

	get(actor: ClinicActor, prescriptionId: string): Promise<DispenseQueueEntry> {
		return this.db.asUser(actor.userId, async (tx) => {
			const entry = await this.load(tx, actor, prescriptionId);
			await this.audit.view(tx, {
				event: 'prescription.view_for_dispense',
				entityType: 'Prescription',
				entityId: entry.prescriptionId,
				userId: actor.userId,
				patientId: entry.patient.id,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
			});
			return entry;
		});
	}

	/** The prescription with its candidates, on the caller's transaction (refused for another clinic's). */
	async load(tx: ClinicalTx, actor: ClinicActor, prescriptionId: string): Promise<DispenseQueueEntry> {
		const row = await this.requireRx(tx, actor, prescriptionId);
		return toEntry(row, await this.candidates(tx, actor, row));
	}

	/** An issued prescription of the actor's clinic. */
	async requireRx(tx: ClinicalTx, actor: ClinicActor, prescriptionId: string): Promise<DispenseRxRow> {
		const row = await this.dispensing.find(tx, prescriptionId);
		if (!row || row.documentStatus !== 'ISSUED') {
			throw new EntityNotFoundError('Prescription', prescriptionId);
		}
		if (row.encounter.clinicId !== actor.clinicId) {
			throw new OtherClinicError('prescription');
		}
		return row;
	}

	/** Per prescription item, the stock items of the same generic and strength with their FEFO lots. */
	private async candidates(
		tx: ClinicalTx,
		actor: ClinicActor,
		row: DispenseRxRow,
	): Promise<Map<string, DispenseCandidate[]>> {
		const today = manilaToday();
		const generics = [...new Set(row.items.map((item) => item.genericName.trim()))];
		const items = await this.items.listByGeneric(tx, actor.organizationId, actor.clinicId, generics);
		const lots = await this.stock.listLots(
			tx,
			actor.clinicId,
			items.map((item) => item.id),
		);
		const result = new Map<string, DispenseCandidate[]>();
		for (const line of row.items) {
			const matches = items.filter(
				(item) =>
					isSameGeneric(line.genericName, item.genericName) && isSameStrength(line.strength, item.strength),
			);
			result.set(
				line.id,
				matches
					.map((item) => toCandidate(item, line, lots, today))
					.sort((a, b) => Number(b.isPrescribed) - Number(a.isPrescribed) || b.usableOnHand - a.usableOnHand),
			);
		}
		return result;
	}
}

function toCandidate(
	item: InventoryItemRow,
	line: DispenseRxRow['items'][number],
	lots: Awaited<ReturnType<StockRepository['listLots']>>,
	today: string,
): DispenseCandidate {
	const own = lots
		.filter((lot) => lot.itemId === item.id)
		.map((lot) => ({
			row: lot,
			id: lot.id,
			lotNo: lot.lotNo,
			expiryDate: dateOnly(lot.expiryDate),
			quantityOnHand: lot.quantityOnHand.toNumber(),
			receivedAt: lot.receivedAt,
		}));
	return {
		itemId: item.id,
		displayName: itemDisplayName(item),
		brandName: item.brandName,
		strength: item.strength,
		dosageForm: item.dosageForm,
		unitOfMeasure: item.unitOfMeasure,
		isDangerousDrug: item.isDangerousDrug,
		isPrescribed: isPrescribedProduct({ inventoryItemId: line.inventoryItemId, brandName: line.brandName }, item),
		usableOnHand: toInventoryItem(item, today).usableOnHand,
		lots: fefoOrder(own, today).map((lot) => toLot(lot.row, today)),
	};
}

/** The queue entry of a prescription; `candidates` empty in the queue list. */
export function toEntry(row: DispenseRxRow, candidates: ReadonlyMap<string, DispenseCandidate[]>): DispenseQueueEntry {
	const signatory = parseSignatory(row.signatory);
	const patient = row.encounter.patient;
	const items = row.items.map((item) => {
		const options = candidates.get(item.id) ?? [];
		const quantity = item.quantity.toNumber();
		const dispensedQty = item.dispensedQty.toNumber();
		return {
			id: item.id,
			genericName: item.genericName,
			brandName: item.brandName,
			strength: item.strength,
			dosageForm: item.dosageForm,
			sig: item.sig,
			quantity,
			quantityInWords: item.quantityInWords,
			unit: item.unit,
			dispensedQty,
			remaining: Math.max(0, Math.round((quantity - dispensedQty) * 100) / 100),
			inventoryItemId: item.inventoryItemId,
			isDangerousDrug: row.isDangerousDrug || options.some((option) => option.isDangerousDrug),
			candidates: options,
		};
	});
	return {
		prescriptionId: row.id,
		rxNo: row.rxNo,
		status: row.status,
		issuedAt: row.issuedAt,
		validUntil: dateOnly(row.validUntil),
		isDangerousDrug: row.isDangerousDrug || items.some((item) => item.isDangerousDrug),
		s2FormSerialNo: row.s2FormSerialNo,
		prescriberName: signatory?.name ?? null,
		prescriberS2LicenseNo: signatory?.s2LicenseNo ?? null,
		s2Missing: s2Missing({
			s2FormSerialNo: row.s2FormSerialNo,
			prescriberS2LicenseNo: signatory?.s2LicenseNo ?? null,
			dangerousLines: items.filter((item) => item.isDangerousDrug),
		}),
		encounterId: row.encounter.id,
		encounterNo: row.encounter.encounterNo,
		patient: {
			id: patient.id,
			name: [patient.firstName, patient.middleName, patient.lastName, patient.suffix].filter(Boolean).join(' '),
			patientNo: patient.patientNo,
			birthDate: dateOnly(patient.birthDate) ?? '',
			sex: patient.sex,
			allergies: patient.allergies.map((allergy) =>
				allergy.reaction ? `${allergy.allergen} (${allergy.reaction})` : allergy.allergen,
			),
		},
		items,
	};
}
