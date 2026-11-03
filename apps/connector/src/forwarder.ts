import { backoffDelay, type BackoffPolicy } from './backoff.ts';
import type { ConnectorState } from './connector-state.ts';
import type { HubClient } from './hub-client.ts';
import { errorText, type Logger } from './logger.ts';
import type { InboundMessage, MessageQueue } from './queue.ts';
import { WorkerLoop } from './worker-loop.ts';

export interface ForwarderOptions {
	queue: MessageQueue;
	hub: Pick<HubClient, 'postMessage'>;
	state: ConnectorState;
	logger: Logger;
	backoff: BackoffPolicy;
	/** Longest sleep when nothing is due; a new message wakes the forwarder sooner. */
	idleMs?: number;
	now?: () => number;
}

/**
 * Pushes queued inbound messages to the hub, oldest first per sender:
 *
 * - hub ACK AA → delivered (body dropped);
 * - hub ACK AE/AR, or a 4xx other than 401/403/408/429 → failed, kept for review, never retried;
 * - network error, timeout or 5xx → retried with capped exponential backoff (the hub dedupes by MSH-10);
 * - 401/403 → the connector halts and alerts; messages stay queued.
 */
export class Forwarder {
	private readonly options: ForwarderOptions;
	private readonly now: () => number;
	private readonly loop: WorkerLoop;

	constructor(options: ForwarderOptions) {
		this.options = options;
		this.now = options.now ?? Date.now;
		this.loop = new WorkerLoop(() => this.tick());
	}

	start(): void {
		this.loop.start();
	}

	/** A message was queued: try it now instead of at the next idle tick. */
	wake(): void {
		this.loop.wake();
	}

	stop(): Promise<void> {
		return this.loop.stop();
	}

	/** Sends everything due; returns how long to sleep before the next look. */
	async tick(): Promise<number> {
		const idleMs = this.options.idleMs ?? 30_000;
		await this.drain();
		if (this.options.state.halted) {
			return idleMs;
		}
		const next = this.options.queue.nextAttemptAt();
		return next === null ? idleMs : Math.min(idleMs, Math.max(0, next - this.now()));
	}

	/** Sends due messages until none is due, the hub looks down, or the connector halts. */
	async drain(): Promise<void> {
		const { queue, state } = this.options;
		while (!state.halted) {
			const batch = queue.due(this.now());
			if (batch.length === 0) {
				return;
			}
			for (const message of batch) {
				if (state.halted) {
					return;
				}
				const hubReachable = await this.send(message);
				if (!hubReachable) {
					// The hub is down: the rest of the batch would only fail the same way. They keep their own
					// schedule and are tried on the next tick.
					return;
				}
			}
		}
	}

	/** Returns false when the hub could not be reached (transient failure or halt). */
	private async send(message: InboundMessage): Promise<boolean> {
		const { queue, hub, state, logger } = this.options;
		const fields = { id: message.id, controlId: message.controlId, messageType: message.messageType };
		if (message.body === null) {
			queue.markFailed(message.id, 'message body missing');
			return true;
		}
		let result;
		try {
			result = await hub.postMessage(message.body);
		} catch (error) {
			result = { kind: 'transient' as const, error: errorText(error) };
		}
		const attempt = message.attempts + 1;
		switch (result.kind) {
			case 'ack':
				state.lastHubSuccessAt = this.now();
				if (result.code === 'AA') {
					queue.markDelivered(message.id, result.code, result.ack, this.now());
					logger.info('message.delivered', { ...fields, attempt });
				} else {
					queue.markFailed(message.id, `hub acknowledged ${result.code}`, result.code, result.ack);
					logger.warn('message.failed', { ...fields, attempt, ackCode: result.code });
				}
				return true;
			case 'rejected':
				queue.markFailed(message.id, result.error);
				logger.warn('message.failed', { ...fields, attempt, status: result.status });
				return true;
			case 'unauthorized':
				queue.scheduleRetry(message.id, `hub responded ${result.status}`, message.nextAttemptAt);
				if (state.halt(`hub rejected the facility key (${result.status}); fix FACILITY_KEY and restart`)) {
					logger.error('connector.halted', { reason: 'unauthorized', status: result.status, alert: true });
				}
				return false;
			case 'transient': {
				const delay = backoffDelay(attempt, this.options.backoff);
				queue.scheduleRetry(message.id, result.error, this.now() + delay);
				state.lastHubError = result.error;
				logger.warn('message.retry', { ...fields, attempt, retryInMs: delay, error: result.error });
				return false;
			}
		}
	}
}
