import { Injectable } from '@nestjs/common';

import type { AuditLog, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** Inserts `audit_logs` rows on the caller's transaction (the table is append-only: a trigger rejects UPDATE/DELETE). */
@Injectable()
export class AuditRepository {
	create(tx: ClinicalTx, data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
		return tx.auditLog.create({ data });
	}

	async createMany(tx: ClinicalTx, data: Prisma.AuditLogCreateManyInput[]): Promise<number> {
		if (data.length === 0) {
			return 0;
		}
		const { count } = await tx.auditLog.createMany({ data });
		return count;
	}
}
