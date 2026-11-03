import type { ConnectorState } from './connector-state.ts';
import { parseAck, parseMsh } from './hl7.ts';
import type { HubClient, HubFailure } from './hub-client.ts';
import { errorText, type Logger } from './logger.ts';
import { mllpSend } from './mllp.ts';
import type { MessageQueue } from './queue.ts';
import { WorkerLoop } from './worker-loop.ts';

export interface OutboxPollerOptions {
	queue: MessageQueue;
	hub: Pick<HubClient, 'fetchOutbox' | 'ackOutbox'>;
	state: ConnectorState;
	logger: Logger;
	lis: { host: string; port: number; timeoutMs: number };
	pollMs: number;
	batchSize?: number;
	/** Injected in tests; defaults to a real MLLP client. */
	send?: typeof mllpSend;
	now?: () => number;
}

/**
 * Hub → LIS: polls the hub outbox for orders, hands each to the facility's LIS over MLLP, reads the LIS ACK and posts
 * it back to the hub. Orders go one at a time, in the hub's order. If the LIS is unreachable the poll stops and the
 * same orders come back next time (the hub keeps them until acked). The LIS ACK is stored before it is posted, so a
 * lost hub ack is re-posted without sending the order to the LIS a second time.
 */
export class OutboxPoller {
	private readonly options: OutboxPollerOptions;
	private readonly loop: WorkerLoop;
	private readonly send: typeof mllpSend;
	private readonly now: () => number;

	constructor(options: OutboxPollerOptions) {
		this.options = options;
		this.send = options.send ?? mllpSend;
		this.now = options.now ?? Date.now;
		this.loop = new WorkerLoop(async () => {
			await this.poll();
			return options.pollMs;
		});
	}

	start(): void {
		this.loop.start();
	}

	stop(): Promise<void> {
		return this.loop.stop();
	}

	/** One poll; returns how many orders were acked to the hub. */
	async poll(): Promise<number> {
		const { hub, queue, state, logger, lis } = this.options;
		if (state.halted) {
			return 0;
		}
		const outbox = await hub.fetchOutbox(this.options.batchSize ?? 20);
		state.lastOutboxPollAt = this.now();
		if (outbox.kind !== 'ok') {
			this.onHubFailure(outbox, 'outbox.poll_failed');
			return 0;
		}
		state.lastHubSuccessAt = this.now();
		let acked = 0;
		for (const item of outbox.items) {
			if (state.halted) {
				break;
			}
			const controlId = parseMsh(item.message)?.controlId ?? '';
			let delivery = queue.getOutboxDelivery(item.id);
			if (!delivery) {
				let rawAck: string;
				try {
					rawAck = await this.send(item.message.replace(/\r\n|\n/g, '\r'), lis);
				} catch (error) {
					logger.warn('outbox.lis_unreachable', { outboxId: item.id, controlId, error: errorText(error) });
					break;
				}
				const ack = parseAck(rawAck);
				if (!ack) {
					logger.warn('outbox.lis_bad_ack', { outboxId: item.id, controlId });
					break;
				}
				queue.recordOutboxDelivery(item.id, controlId, ack.code, rawAck, this.now());
				delivery = queue.getOutboxDelivery(item.id)!;
				logger.info('outbox.delivered_to_lis', { outboxId: item.id, controlId, ackCode: ack.code });
			}
			const result = await hub.ackOutbox(item.id, delivery.lisAckCode, delivery.lisAck);
			if (result.kind === 'ok' || (result.kind === 'rejected' && result.status === 404)) {
				// 404: the hub no longer has it (already acked); nothing left to do.
				queue.markOutboxAcked(item.id, this.now());
				acked += 1;
				logger.info('outbox.acked', { outboxId: item.id, controlId, ackCode: delivery.lisAckCode });
				continue;
			}
			this.onHubFailure(result, 'outbox.ack_failed', { outboxId: item.id, controlId });
			break;
		}
		return acked;
	}

	private onHubFailure(failure: HubFailure, event: string, fields: Record<string, string> = {}): void {
		const { state, logger } = this.options;
		if (failure.kind === 'unauthorized') {
			if (state.halt(`hub rejected the facility key (${failure.status}); fix FACILITY_KEY and restart`)) {
				logger.error('connector.halted', { reason: 'unauthorized', status: failure.status, alert: true });
			}
			return;
		}
		state.lastHubError = failure.error;
		logger.warn(event, { ...fields, error: failure.error });
	}
}
