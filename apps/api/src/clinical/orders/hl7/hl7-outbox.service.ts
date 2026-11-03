import { Injectable } from '@nestjs/common';

import { HandlerError } from '../../../common/errors/handler-error.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { Hl7OutboxRepository } from './hl7-outbox.repository.js';

export const ACK_CODES = ['AA', 'AE', 'AR'] as const;
export type AckCode = (typeof ACK_CODES)[number];

export interface OutboxMessage {
	id: string;
	message: string;
}

export interface OutboxAckResult {
	id: string;
	status: 'pending' | 'delivered' | 'failed';
}

const MAX_LIMIT = 100;

/**
 * The edge connector's side of outbound HL7 (DESIGN.md §11): it pulls its facility's pending ORM messages, forwards
 * them over MLLP and posts back the lab system's ACK. AA marks the message delivered; AE and AR mark it failed (the
 * hub does not resend: a failed order shows on the worklist instead). A message stays pending, and is handed out
 * again, until its ACK arrives.
 */
@Injectable()
export class Hl7OutboxService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly outbox: Hl7OutboxRepository,
	) {}

	async pending(orgId: string, limit = 20): Promise<OutboxMessage[]> {
		const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), MAX_LIMIT);
		const rows = await this.db.asSystem((tx) => this.outbox.takePending(tx, orgId, take));
		return rows.map(({ id, message }) => ({ id, message }));
	}

	async ack(orgId: string, id: string, code: string, ack: string | null): Promise<OutboxAckResult> {
		if (!(ACK_CODES as readonly string[]).includes(code)) {
			throw new HandlerError('BAD_REQUEST', 'code must be AA, AE or AR.');
		}
		return this.db.asSystem(async (tx) => {
			const row = await this.outbox.findForOrg(tx, orgId, id);
			if (!row) {
				throw new HandlerError('NOT_FOUND', 'Message not found.');
			}
			if (row.status !== 'pending') {
				return { id: row.id, status: row.status };
			}
			const updated = await this.outbox.update(tx, row.id, {
				status: code === 'AA' ? 'delivered' : 'failed',
				ackCode: code,
				ack: ack ?? null,
				ackedAt: new Date(),
			});
			return { id: updated.id, status: updated.status };
		});
	}
}
