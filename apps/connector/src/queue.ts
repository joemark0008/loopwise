import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { AckCode } from './hl7.ts';

/**
 * The connector's durable store, a SQLite file through Node's built-in `node:sqlite` (no native dependency).
 *
 * - `inbound_message`: what the LIS sent, until the hub acknowledges it. A row is written (and committed, WAL with
 *   `synchronous = FULL`) before the LIS gets its ACK, so an accepted message survives a crash or restart.
 *   Delivered rows keep their metadata but drop the body (no PHI kept once the hub has it); failed rows keep the body
 *   for review.
 * - `outbox_delivery`: hub orders already handed to the LIS, with the LIS ACK, so a lost hub ack is re-posted without
 *   sending the order to the LIS twice.
 */
export type InboundStatus = 'pending' | 'delivered' | 'failed';

export interface InboundMessage {
	id: number;
	controlId: string;
	sender: string;
	messageType: string;
	body: string | null;
	status: InboundStatus;
	attempts: number;
	receivedAt: number;
	nextAttemptAt: number;
	lastError: string | null;
	hubAckCode: AckCode | null;
	hubAck: string | null;
	deliveredAt: number | null;
}

export interface EnqueueInput {
	controlId: string;
	sender: string;
	messageType: string;
	body: string;
}

export interface QueueStats {
	pending: number;
	failed: number;
	delivered: number;
	/** Age of the oldest pending message, ms; null when none waits. */
	oldestPendingMs: number | null;
	lastDeliveredAt: number | null;
}

export interface OutboxDelivery {
	id: string;
	controlId: string;
	lisAckCode: AckCode;
	lisAck: string;
	deliveredAt: number;
	hubAckedAt: number | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS inbound_message (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	control_id TEXT NOT NULL,
	sender TEXT NOT NULL,
	message_type TEXT NOT NULL,
	body TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
	attempts INTEGER NOT NULL DEFAULT 0,
	received_at INTEGER NOT NULL,
	next_attempt_at INTEGER NOT NULL,
	last_error TEXT,
	hub_ack_code TEXT,
	hub_ack TEXT,
	delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS inbound_message_pending ON inbound_message (status, sender, id);
CREATE TABLE IF NOT EXISTS outbox_delivery (
	id TEXT PRIMARY KEY,
	control_id TEXT NOT NULL,
	lis_ack_code TEXT NOT NULL,
	lis_ack TEXT NOT NULL,
	delivered_at INTEGER NOT NULL,
	hub_acked_at INTEGER
);
`;

interface InboundRow {
	id: number;
	control_id: string;
	sender: string;
	message_type: string;
	body: string | null;
	status: InboundStatus;
	attempts: number;
	received_at: number;
	next_attempt_at: number;
	last_error: string | null;
	hub_ack_code: AckCode | null;
	hub_ack: string | null;
	delivered_at: number | null;
}

function toMessage(row: InboundRow): InboundMessage {
	return {
		id: row.id,
		controlId: row.control_id,
		sender: row.sender,
		messageType: row.message_type,
		body: row.body,
		status: row.status,
		attempts: row.attempts,
		receivedAt: row.received_at,
		nextAttemptAt: row.next_attempt_at,
		lastError: row.last_error,
		hubAckCode: row.hub_ack_code,
		hubAck: row.hub_ack,
		deliveredAt: row.delivered_at,
	};
}

export class MessageQueue {
	private readonly db: DatabaseSync;

	constructor(file: string) {
		if (file !== ':memory:') {
			mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
		}
		this.db = new DatabaseSync(file);
		this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;');
		this.db.exec(SCHEMA);
	}

	enqueue(input: EnqueueInput, now = Date.now()): InboundMessage {
		const row = this.db
			.prepare(
				`INSERT INTO inbound_message (control_id, sender, message_type, body, received_at, next_attempt_at)
				 VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
			)
			.get(input.controlId, input.sender, input.messageType, input.body, now, now) as unknown as InboundRow;
		return toMessage(row);
	}

	get(id: number): InboundMessage | null {
		const row = this.db.prepare('SELECT * FROM inbound_message WHERE id = ?').get(id) as InboundRow | undefined;
		return row ? toMessage(row) : null;
	}

	/**
	 * Messages ready to send now: only the oldest pending message of each sender (so a sender's messages reach the hub
	 * in the order it sent them), and only once its backoff has passed. Failed messages no longer block their sender.
	 */
	due(now = Date.now(), limit = 50): InboundMessage[] {
		const rows = this.db
			.prepare(
				`SELECT m.* FROM inbound_message m
				 WHERE m.status = 'pending'
				   AND m.id = (SELECT min(id) FROM inbound_message WHERE status = 'pending' AND sender = m.sender)
				   AND m.next_attempt_at <= ?
				 ORDER BY m.id LIMIT ?`,
			)
			.all(now, limit) as unknown as InboundRow[];
		return rows.map(toMessage);
	}

	/** When the next pending message becomes due (ms epoch), or null when nothing is pending. */
	nextAttemptAt(): number | null {
		const row = this.db
			.prepare(
				`SELECT min(m.next_attempt_at) AS at FROM inbound_message m
				 WHERE m.status = 'pending'
				   AND m.id = (SELECT min(id) FROM inbound_message WHERE status = 'pending' AND sender = m.sender)`,
			)
			.get() as { at: number | null };
		return row.at;
	}

	markDelivered(id: number, ackCode: AckCode, ack: string, now = Date.now()): void {
		this.db
			.prepare(
				`UPDATE inbound_message
				 SET status = 'delivered', body = NULL, attempts = attempts + 1, hub_ack_code = ?, hub_ack = ?,
				     delivered_at = ?, last_error = NULL
				 WHERE id = ?`,
			)
			.run(ackCode, ack, now, id);
	}

	/** A poison message (hub AE/AR, or a request the hub refuses outright): kept with its body for review. */
	markFailed(id: number, error: string, ackCode: AckCode | null = null, ack: string | null = null): void {
		this.db
			.prepare(
				`UPDATE inbound_message
				 SET status = 'failed', attempts = attempts + 1, last_error = ?, hub_ack_code = ?, hub_ack = ?
				 WHERE id = ?`,
			)
			.run(error, ackCode, ack, id);
	}

	scheduleRetry(id: number, error: string, nextAttemptAt: number): void {
		this.db
			.prepare(
				`UPDATE inbound_message SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?`,
			)
			.run(error, nextAttemptAt, id);
	}

	/** Puts a failed message back in the queue after review (e.g. once the hub's mapping is fixed). */
	requeue(id: number, now = Date.now()): boolean {
		const result = this.db
			.prepare(
				`UPDATE inbound_message SET status = 'pending', next_attempt_at = ?, attempts = 0
				 WHERE id = ? AND status = 'failed'`,
			)
			.run(now, id);
		return result.changes === 1;
	}

	failed(limit = 100): InboundMessage[] {
		const rows = this.db
			.prepare(`SELECT * FROM inbound_message WHERE status = 'failed' ORDER BY id LIMIT ?`)
			.all(limit) as unknown as InboundRow[];
		return rows.map(toMessage);
	}

	stats(now = Date.now()): QueueStats {
		const counts = this.db
			.prepare(
				`SELECT
					sum(status = 'pending') AS pending,
					sum(status = 'failed') AS failed,
					sum(status = 'delivered') AS delivered,
					min(CASE WHEN status = 'pending' THEN received_at END) AS oldest,
					max(delivered_at) AS last_delivered
				 FROM inbound_message`,
			)
			.get() as {
			pending: number | null;
			failed: number | null;
			delivered: number | null;
			oldest: number | null;
			last_delivered: number | null;
		};
		return {
			pending: counts.pending ?? 0,
			failed: counts.failed ?? 0,
			delivered: counts.delivered ?? 0,
			oldestPendingMs: counts.oldest === null ? null : now - counts.oldest,
			lastDeliveredAt: counts.last_delivered,
		};
	}

	getOutboxDelivery(id: string): OutboxDelivery | null {
		const row = this.db.prepare('SELECT * FROM outbox_delivery WHERE id = ?').get(id) as
			| {
					id: string;
					control_id: string;
					lis_ack_code: AckCode;
					lis_ack: string;
					delivered_at: number;
					hub_acked_at: number | null;
			  }
			| undefined;
		if (!row) {
			return null;
		}
		return {
			id: row.id,
			controlId: row.control_id,
			lisAckCode: row.lis_ack_code,
			lisAck: row.lis_ack,
			deliveredAt: row.delivered_at,
			hubAckedAt: row.hub_acked_at,
		};
	}

	recordOutboxDelivery(id: string, controlId: string, lisAckCode: AckCode, lisAck: string, now = Date.now()): void {
		this.db
			.prepare(
				`INSERT INTO outbox_delivery (id, control_id, lis_ack_code, lis_ack, delivered_at) VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (id) DO NOTHING`,
			)
			.run(id, controlId, lisAckCode, lisAck, now);
	}

	markOutboxAcked(id: string, now = Date.now()): void {
		this.db.prepare('UPDATE outbox_delivery SET hub_acked_at = ? WHERE id = ?').run(now, id);
	}

	close(): void {
		if (this.db.isOpen) {
			this.db.close();
		}
	}
}
