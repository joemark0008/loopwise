import { Injectable } from '@nestjs/common';

import type { Prisma, StockMovementType } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

const chargeInclude = {
	item: {
		select: {
			id: true,
			name: true,
			genericName: true,
			brandName: true,
			sellingPrice: true,
			taxType: true,
			serviceItem: {
				select: {
					id: true,
					isActive: true,
					defaultPrice: true,
					taxType: true,
					clinicPrices: { select: { clinicId: true, price: true } },
				},
			},
		},
	},
} satisfies Prisma.StockMovementInclude;

export type ChargeMovementRow = Prisma.StockMovementGetPayload<{ include: typeof chargeInclude }>;

/** The stock movements of a visit that the cashier bills, with each item's sale price (row-level security). */
@Injectable()
export class InventoryBillingRepository {
	listForEncounter(
		tx: ClinicalTx,
		encounterId: string,
		types: readonly StockMovementType[],
	): Promise<ChargeMovementRow[]> {
		return tx.stockMovement.findMany({
			where: { encounterId, type: { in: [...types] } },
			include: chargeInclude,
			orderBy: [{ performedAt: 'asc' }, { id: 'asc' }],
		});
	}
}
