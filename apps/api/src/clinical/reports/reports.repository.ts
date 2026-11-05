import { Injectable } from '@nestjs/common';

import type { ClinicalDocument, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** A saved report with the name of who saved it (`created_by_id` is a plain id: the user is looked up). */
export type DocumentRow = ClinicalDocument & { createdByName: string };

/** Clinical reads and writes of Wise reports, in the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class ReportsRepository {
	/** The patient's organization, when the user may see them (row-level security); null otherwise. */
	visiblePatient(tx: ClinicalTx, patientId: string): Promise<{ organizationId: string } | null> {
		return tx.patient.findFirst({ where: { id: patientId, deletedAt: null }, select: { organizationId: true } });
	}

	/** Names of the patients the user may see, by id; a patient they can't see is simply missing. */
	async patientNames(tx: ClinicalTx, patientIds: string[]): Promise<Map<string, string>> {
		if (patientIds.length === 0) {
			return new Map();
		}
		const rows = await tx.patient.findMany({
			where: { id: { in: patientIds } },
			select: { id: true, firstName: true, lastName: true },
		});
		return new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`]));
	}

	async userName(tx: ClinicalTx, userId: string): Promise<string> {
		return (await this.userNames(tx, [userId])).get(userId) ?? 'Unknown user';
	}

	async createDocument(tx: ClinicalTx, data: Prisma.ClinicalDocumentUncheckedCreateInput): Promise<DocumentRow> {
		return (await this.withAuthors(tx, [await tx.clinicalDocument.create({ data })]))[0];
	}

	async documentBySource(tx: ClinicalTx, sourceToolCallId: string): Promise<DocumentRow | null> {
		const row = await tx.clinicalDocument.findUnique({ where: { sourceToolCallId } });
		return row && (await this.withAuthors(tx, [row]))[0];
	}

	async document(tx: ClinicalTx, id: string): Promise<DocumentRow | null> {
		const row = await tx.clinicalDocument.findUnique({ where: { id } });
		return row && (await this.withAuthors(tx, [row]))[0];
	}

	async patientDocuments(tx: ClinicalTx, patientId: string): Promise<DocumentRow[]> {
		const rows = await tx.clinicalDocument.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
		return this.withAuthors(tx, rows);
	}

	private async withAuthors(tx: ClinicalTx, rows: ClinicalDocument[]): Promise<DocumentRow[]> {
		const names = await this.userNames(tx, [...new Set(rows.map((row) => row.createdById))]);
		return rows.map((row) => ({ ...row, createdByName: names.get(row.createdById) ?? 'Unknown user' }));
	}

	private async userNames(tx: ClinicalTx, ids: string[]): Promise<Map<string, string>> {
		if (ids.length === 0) {
			return new Map();
		}
		const users = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
		return new Map(users.map((user) => [user.id, user.name]));
	}
}
