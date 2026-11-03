import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { PrescriptionRow } from './models/prescription.model.js';

type Tx = Prisma.TransactionClient;
type ItemData = Omit<Prisma.PrescriptionItemCreateManyInput, 'prescriptionId'>;

/** Prescriptions and their items. Every method takes the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class PrescriptionRepository {
	findById(tx: Tx, id: string): Promise<PrescriptionRow | null> {
		return tx.prescription.findUnique({ where: { id }, include: { items: true } });
	}

	create(
		tx: Tx,
		data: Omit<Prisma.PrescriptionUncheckedCreateInput, 'items'>,
		items: ItemData[],
	): Promise<PrescriptionRow> {
		return tx.prescription.create({
			data: { ...data, items: { createMany: { data: items } } },
			include: { items: true },
		});
	}

	/** Replaces a draft's notes and items (the lock trigger refuses this once it is issued). */
	async replaceDraft(tx: Tx, id: string, notes: string | null, items: ItemData[]): Promise<PrescriptionRow> {
		await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
		return tx.prescription.update({
			where: { id },
			data: { notes, items: { createMany: { data: items } } },
			include: { items: true },
		});
	}

	update(tx: Tx, id: string, data: Prisma.PrescriptionUncheckedUpdateInput): Promise<PrescriptionRow> {
		return tx.prescription.update({ where: { id }, data, include: { items: true } });
	}

	listActiveAllergies(tx: Tx, patientId: string) {
		return tx.patientAllergy.findMany({ where: { patientId, voidedAt: null }, select: { substance: true } });
	}
}
