import { Injectable } from '@nestjs/common';

import type { PrescriptionStatus, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

export const DISPENSE_RX_INCLUDE = {
	items: { orderBy: { sortOrder: 'asc' } },
	encounter: {
		select: {
			id: true,
			encounterNo: true,
			clinicId: true,
			patient: {
				select: {
					id: true,
					patientNo: true,
					firstName: true,
					middleName: true,
					lastName: true,
					suffix: true,
					birthDate: true,
					sex: true,
					allergies: {
						where: { isActive: true, voidedAt: null },
						select: { allergen: true, reaction: true, severity: true },
					},
				},
			},
		},
	},
} satisfies Prisma.PrescriptionInclude;

export type DispenseRxRow = Prisma.PrescriptionGetPayload<{ include: typeof DISPENSE_RX_INCLUDE }>;

/**
 * The pharmacy's reads of issued prescriptions (row-level security: the pharmacy desk sees the issued prescriptions of
 * its clinic, their visit and patient, `0002_inventory`). Writes to prescriptions go through `PrescriptionService`.
 */
@Injectable()
export class DispensingRepository {
	/** Issued, unvoided prescriptions of the clinic in these statuses, oldest first (the order they are served). */
	listQueue(
		tx: ClinicalTx,
		clinicId: string,
		statuses: readonly PrescriptionStatus[],
		since: Date,
	): Promise<DispenseRxRow[]> {
		return tx.prescription.findMany({
			where: {
				documentStatus: 'ISSUED',
				voidedAt: null,
				status: { in: [...statuses] },
				issuedAt: { gte: since },
				encounter: { clinicId },
			},
			include: DISPENSE_RX_INCLUDE,
			orderBy: { issuedAt: 'asc' },
			take: 200,
		});
	}

	find(tx: ClinicalTx, id: string): Promise<DispenseRxRow | null> {
		return tx.prescription.findUnique({ where: { id }, include: DISPENSE_RX_INCLUDE });
	}
}
