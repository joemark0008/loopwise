import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

export interface AuditEntry {
	/** Null for system work (HL7 ingest), with `origin` saying where it came from. */
	userId: string | null;
	orgId: string | null;
	patientId: string;
	/** `<resource>.<verb>`, e.g. `prescription.issue`. */
	action: string;
	resource: string;
	resourceId: string;
	reason?: string | null;
	/** Set when the action came from a confirmed Wise card (`WiseProposalService.verify`). */
	origin?: Prisma.InputJsonObject | null;
}

/** Writes `AuditLog` rows (DESIGN.md §8.6) in the caller's transaction, so the row and the change commit together. */
@Injectable()
export class ClinicalAuditRepository {
	write(tx: Tx, entry: AuditEntry) {
		return tx.auditLog.create({
			data: { ...entry, reason: entry.reason ?? null, origin: entry.origin ?? undefined },
		});
	}
}
