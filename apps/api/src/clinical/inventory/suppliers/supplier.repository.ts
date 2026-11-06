import { Injectable } from '@nestjs/common';

import type { Prisma, Supplier } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** The organization's suppliers (`suppliers`), under row-level security. Takes the caller's transaction. */
@Injectable()
export class SupplierRepository {
	list(tx: ClinicalTx, organizationId: string, includeInactive: boolean): Promise<Supplier[]> {
		return tx.supplier.findMany({
			where: { organizationId, ...(includeInactive ? {} : { isActive: true }) },
			orderBy: { name: 'asc' },
		});
	}

	find(tx: ClinicalTx, id: string): Promise<Supplier | null> {
		return tx.supplier.findUnique({ where: { id } });
	}

	create(tx: ClinicalTx, data: Prisma.SupplierUncheckedCreateInput): Promise<Supplier> {
		return tx.supplier.create({ data });
	}

	update(tx: ClinicalTx, id: string, data: Prisma.SupplierUncheckedUpdateInput): Promise<Supplier> {
		return tx.supplier.update({ where: { id }, data });
	}
}
