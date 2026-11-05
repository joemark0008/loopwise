import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';

const withAuthor = { createdBy: { select: { name: true } } } satisfies Prisma.ClinicalDocumentInclude;
export type DocumentRow = Prisma.ClinicalDocumentGetPayload<{ include: typeof withAuthor }>;

type Tx = Prisma.TransactionClient;

/** Clinical reads and audit rows of Wise reports, in the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class ReportsRepository {
	async isVisible(tx: Tx, patientId: string): Promise<boolean> {
		return (await tx.patient.count({ where: { id: patientId } })) > 0;
	}

	/** Names of the patients the user may see, by id; a patient they can't see is simply missing. */
	async patientNames(tx: Tx, patientIds: string[]): Promise<Map<string, string>> {
		if (patientIds.length === 0) {
			return new Map();
		}
		const rows = await tx.patient.findMany({
			where: { id: { in: patientIds } },
			select: { id: true, givenName: true, familyName: true },
		});
		return new Map(rows.map((row) => [row.id, `${row.givenName} ${row.familyName}`]));
	}

	async userName(tx: Tx, userId: string): Promise<string> {
		return (await tx.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? 'Unknown user';
	}

	writeAudit(
		tx: Tx,
		entry: {
			userId: string;
			patientId: string | null;
			action: string;
			resource?: string;
			resourceId: string;
			reason: string;
			origin?: Prisma.InputJsonValue;
		},
	) {
		return tx.auditLog.create({
			data: {
				userId: entry.userId,
				patientId: entry.patientId,
				action: entry.action,
				resource: entry.resource ?? 'report',
				resourceId: entry.resourceId,
				reason: entry.reason,
				...(entry.origin && { origin: entry.origin }),
			},
		});
	}

	createDocument(tx: Tx, data: Prisma.ClinicalDocumentUncheckedCreateInput): Promise<DocumentRow> {
		return tx.clinicalDocument.create({ data, include: withAuthor });
	}

	documentBySource(tx: Tx, sourceToolCallId: string): Promise<DocumentRow | null> {
		return tx.clinicalDocument.findUnique({ where: { sourceToolCallId }, include: withAuthor });
	}

	document(tx: Tx, id: string): Promise<DocumentRow | null> {
		return tx.clinicalDocument.findUnique({ where: { id }, include: withAuthor });
	}

	patientDocuments(tx: Tx, patientId: string): Promise<DocumentRow[]> {
		return tx.clinicalDocument.findMany({
			where: { patientId },
			include: withAuthor,
			orderBy: { createdAt: 'desc' },
		});
	}
}
