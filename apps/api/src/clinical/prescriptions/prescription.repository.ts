import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';
import { PRESCRIPTION_INCLUDE, type PrescriptionRow } from './models/prescription.model.js';

export type PrescriptionItemData = Omit<Prisma.PrescriptionItemCreateManyInput, 'prescriptionId'>;

/**
 * Prescriptions and their items, reached through their encounter (row-level security). Every method takes the
 * transaction of `ClinicalDbService.asUser`.
 */
@Injectable()
export class PrescriptionRepository {
	findById(tx: ClinicalTx, id: string): Promise<PrescriptionRow | null> {
		return tx.prescription.findUnique({ where: { id }, include: PRESCRIPTION_INCLUDE });
	}

	/** The prescriptions of the encounters, newest first. */
	listByEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<PrescriptionRow[]> {
		return tx.prescription.findMany({
			where: { encounterId: { in: [...encounterIds] } },
			include: PRESCRIPTION_INCLUDE,
			orderBy: { createdAt: 'desc' },
		});
	}

	create(
		tx: ClinicalTx,
		data: Omit<Prisma.PrescriptionUncheckedCreateInput, 'items'>,
		items: PrescriptionItemData[],
	): Promise<PrescriptionRow> {
		return tx.prescription.create({
			data: { ...data, items: { createMany: { data: items } } },
			include: PRESCRIPTION_INCLUDE,
		});
	}

	/**
	 * Replaces a draft's fields and items. With `expectedVersion` only while the version is still that one (null when
	 * it moved on). The lock trigger refuses this once the prescription is issued.
	 */
	async replaceDraft(
		tx: ClinicalTx,
		id: string,
		data: Prisma.PrescriptionUncheckedUpdateManyInput,
		items: PrescriptionItemData[],
		expectedVersion?: number | null,
	): Promise<PrescriptionRow | null> {
		const { count } = await tx.prescription.updateMany({
			where: { id, ...(expectedVersion != null && { version: expectedVersion }) },
			data,
		});
		if (count === 0) {
			return null;
		}
		await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
		await tx.prescriptionItem.createMany({ data: items.map((item) => ({ ...item, prescriptionId: id })) });
		return this.findById(tx, id);
	}

	/**
	 * Adds `quantity` to an issued item's dispensed quantity and links the stock item when it had none (the only line
	 * columns the `prescription_items_lock` trigger lets move after issue; a check keeps it within the prescribed
	 * quantity).
	 */
	async addDispensed(
		tx: ClinicalTx,
		itemId: string,
		quantity: number,
		inventoryItemId: string | null,
	): Promise<void> {
		await tx.prescriptionItem.update({
			where: { id: itemId },
			data: { dispensedQty: { increment: quantity }, ...(inventoryItemId ? { inventoryItemId } : {}) },
		});
	}

	update(tx: ClinicalTx, id: string, data: Prisma.PrescriptionUncheckedUpdateInput): Promise<PrescriptionRow> {
		return tx.prescription.update({ where: { id }, data, include: PRESCRIPTION_INCLUDE });
	}
}
