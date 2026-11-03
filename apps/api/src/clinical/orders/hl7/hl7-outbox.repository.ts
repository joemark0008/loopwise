import { Injectable } from '@nestjs/common';

import type { Hl7Outbox, Prisma } from '../../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** The outbound HL7 queue. System work (`ClinicalDbService.asSystem`): the edge connector acts for its facility. */
@Injectable()
export class Hl7OutboxRepository {
	/** The facility's pending messages, oldest first, counted as fetched once more. */
	async takePending(tx: Tx, orgId: string, limit: number): Promise<Hl7Outbox[]> {
		const rows = await tx.hl7Outbox.findMany({
			where: { orgId, status: 'pending' },
			orderBy: { createdAt: 'asc' },
			take: limit,
		});
		if (rows.length > 0) {
			await tx.hl7Outbox.updateMany({
				where: { id: { in: rows.map((row) => row.id) } },
				data: { attempts: { increment: 1 }, lastFetchedAt: new Date() },
			});
		}
		return rows;
	}

	findForOrg(tx: Tx, orgId: string, id: string): Promise<Hl7Outbox | null> {
		return tx.hl7Outbox.findFirst({ where: { id, orgId } });
	}

	update(tx: Tx, id: string, data: Prisma.Hl7OutboxUpdateInput): Promise<Hl7Outbox> {
		return tx.hl7Outbox.update({ where: { id }, data });
	}
}
