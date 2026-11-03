import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { BillRow } from './models/encounter-bill.model.js';

type Tx = Prisma.TransactionClient;
type ChargeData = Omit<Prisma.EncounterChargeCreateManyInput, 'billId'>;

/** Encounter bills and their charges. Every method takes the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class BillingRepository {
	findById(tx: Tx, id: string): Promise<BillRow | null> {
		return tx.encounterBill.findUnique({ where: { id }, include: { charges: true } });
	}

	/** The bill that is not voided (at most one per encounter). */
	findActive(tx: Tx, encounterId: string): Promise<BillRow | null> {
		return tx.encounterBill.findFirst({
			where: { encounterId, status: { not: 'voided' } },
			include: { charges: true },
		});
	}

	create(
		tx: Tx,
		data: Omit<Prisma.EncounterBillUncheckedCreateInput, 'charges'>,
		charges: ChargeData[],
	): Promise<BillRow> {
		return tx.encounterBill.create({
			data: { ...data, charges: { createMany: { data: charges } } },
			include: { charges: true },
		});
	}

	/** Replaces a draft's charges and totals (the lock trigger refuses this once it is finalized). */
	async replaceDraft(
		tx: Tx,
		id: string,
		data: Prisma.EncounterBillUncheckedUpdateInput,
		charges: ChargeData[],
	): Promise<BillRow> {
		await tx.encounterCharge.deleteMany({ where: { billId: id } });
		return tx.encounterBill.update({
			where: { id },
			data: { ...data, charges: { createMany: { data: charges } } },
			include: { charges: true },
		});
	}

	update(tx: Tx, id: string, data: Prisma.EncounterBillUncheckedUpdateInput): Promise<BillRow> {
		return tx.encounterBill.update({ where: { id }, data, include: { charges: true } });
	}
}
