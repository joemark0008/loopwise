import { Injectable } from '@nestjs/common';

import { currentRequestContext } from '../../common/request-context.js';
import type { AuditLog, Prisma } from '../../generated/prisma/client.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditEntry } from './audit.types.js';

/**
 * The audit trail (DESIGN.md §8.6; RA 10173, the Data Privacy Act: who accessed or changed
 * personal health information). Every view of a patient's record and every state change goes through here, never
 * through an ad hoc `auditLog.create`. The request id, ip and user agent come from the request context.
 *
 * Write the row on the same transaction as the change (`record(tx, …)` inside `ClinicalDbService.asUser`), so either
 * both commit or neither does. Inside `asUser(userId, …)` the entry's `userId` must be that user (row-level security);
 * system work uses an `asSystem` transaction.
 */
@Injectable()
export class AuditService {
	constructor(
		private readonly repository: AuditRepository,
		private readonly db: ClinicalDbService,
	) {}

	/** Writes one audit row on `tx`. */
	record(tx: ClinicalTx, entry: AuditEntry): Promise<AuditLog> {
		return this.repository.create(tx, toRow(entry));
	}

	/** Writes several rows on `tx` in one statement (e.g. one `VIEW` per patient of a list). Returns the count. */
	recordMany(tx: ClinicalTx, entries: readonly AuditEntry[]): Promise<number> {
		return this.repository.createMany(tx, entries.map(toRow));
	}

	/** A `VIEW` row: the user opened a record (`patient.view`, `encounter.view`, `result.list` …). */
	view(tx: ClinicalTx, entry: Omit<AuditEntry, 'action'>): Promise<AuditLog> {
		return this.record(tx, { ...entry, action: 'VIEW' });
	}

	/** A `CREATE` row, normally with `changes: { after: auditSnapshot(row) }`. */
	created(tx: ClinicalTx, entry: Omit<AuditEntry, 'action'>): Promise<AuditLog> {
		return this.record(tx, { ...entry, action: 'CREATE' });
	}

	/** An `UPDATE` row, normally with `changes: auditChanges(before, after)`. */
	updated(tx: ClinicalTx, entry: Omit<AuditEntry, 'action'>): Promise<AuditLog> {
		return this.record(tx, { ...entry, action: 'UPDATE' });
	}

	/**
	 * Writes one row in a transaction of its own, as system work: for events with nothing else to commit (a refused
	 * analytics query, a failed sign-in). Prefer `record(tx, …)` whenever there is a transaction.
	 */
	recordOutsideTransaction(entry: AuditEntry): Promise<AuditLog> {
		return this.db.asSystem((tx) => this.record(tx, entry));
	}
}

function toRow(entry: AuditEntry): Prisma.AuditLogUncheckedCreateInput {
	const context = currentRequestContext();
	return {
		action: entry.action,
		event: entry.event,
		entityType: entry.entityType,
		entityId: entry.entityId ?? null,
		userId: entry.userId,
		patientId: entry.patientId ?? null,
		organizationId: entry.organizationId ?? null,
		clinicId: entry.clinicId ?? null,
		changes: entry.changes ? (entry.changes as Prisma.InputJsonObject) : undefined,
		reason: entry.reason ?? null,
		origin: entry.origin ?? undefined,
		requestId: entry.request?.requestId ?? context?.requestId ?? null,
		ipAddress: entry.request?.ipAddress ?? context?.ipAddress ?? null,
		userAgent: entry.request?.userAgent ?? context?.userAgent ?? null,
	};
}
