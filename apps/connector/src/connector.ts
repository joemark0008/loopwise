import http from 'node:http';
import type net from 'node:net';

import type { ConnectorConfig } from './config.ts';
import { isInsecureHubUrl } from './config.ts';
import { ConnectorState } from './connector-state.ts';
import { Forwarder } from './forwarder.ts';
import { HubClient } from './hub-client.ts';
import type { Logger } from './logger.ts';
import { createMllpServer } from './mllp-server.ts';
import { OutboxPoller } from './outbox-poller.ts';
import { MessageQueue } from './queue.ts';

export interface ConnectorStatus {
	status: 'ok' | 'halted';
	haltReason: string | null;
	queue: ReturnType<MessageQueue['stats']>;
	lastHubSuccessAt: string | null;
	lastHubError: string | null;
	outbox: { enabled: boolean; lastPollAt: string | null };
}

export interface Connector {
	queue: MessageQueue;
	state: ConnectorState;
	forwarder: Forwarder;
	outbox: OutboxPoller | null;
	/** Bound ports (useful with port 0 in tests). */
	ports: { mllp: number; health: number | null };
	status(): ConnectorStatus;
	stop(): Promise<void>;
}

export interface StartConnectorOptions {
	logger: Logger;
	fetch?: typeof fetch;
}

/** Opens the queue, starts the MLLP listener, the forwarder, the outbox poller (when an LIS is set) and /health. */
export async function startConnector(config: ConnectorConfig, options: StartConnectorOptions): Promise<Connector> {
	const { logger } = options;
	if (isInsecureHubUrl(config.hubUrl)) {
		logger.warn('config.insecure_hub_url', { reason: 'HUB_URL is plain http to another host: use https' });
	}
	const queue = new MessageQueue(config.queuePath);
	const state = new ConnectorState();
	const hub = new HubClient({
		hubUrl: config.hubUrl,
		facilityKey: config.facilityKey,
		timeoutMs: config.hubTimeoutMs,
		fetch: options.fetch,
	});
	const forwarder = new Forwarder({
		queue,
		hub,
		state,
		logger,
		backoff: { baseMs: config.retryBaseMs, maxMs: config.retryMaxMs },
	});
	const outbox = config.lis
		? new OutboxPoller({
				queue,
				hub,
				state,
				logger,
				lis: { ...config.lis, timeoutMs: config.lisTimeoutMs },
				pollMs: config.outboxPollMs,
			})
		: null;

	const status = (): ConnectorStatus => ({
		status: state.halted ? 'halted' : 'ok',
		haltReason: state.haltReason,
		queue: queue.stats(),
		lastHubSuccessAt: iso(state.lastHubSuccessAt),
		lastHubError: state.lastHubError,
		outbox: { enabled: outbox !== null, lastPollAt: iso(state.lastOutboxPollAt) },
	});

	const mllp = createMllpServer({ queue, logger, identity: config.identity, onQueued: () => forwarder.wake() });
	let health: http.Server | null = null;
	let statusTimer: NodeJS.Timeout | null = null;
	try {
		const mllpPort = await mllp.listen(config.mllpPort, config.mllpHost);
		let healthPort: number | null = null;
		if (config.healthPort !== null) {
			health = http.createServer((req, res) => {
				if (req.method === 'GET' && (req.url === '/health' || req.url === '/healthz')) {
					const body = status();
					res.writeHead(body.status === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
					res.end(JSON.stringify(body));
					return;
				}
				res.writeHead(404).end();
			});
			healthPort = await new Promise<number>((resolve, reject) => {
				health!.once('error', reject);
				health!.listen(config.healthPort!, () => resolve((health!.address() as net.AddressInfo).port));
			});
		}
		forwarder.start();
		outbox?.start();
		if (config.statusLogMs > 0) {
			statusTimer = setInterval(() => logStatus(logger, status()), config.statusLogMs);
			statusTimer.unref();
		}
		logger.info('connector.started', {
			mllpPort,
			healthPort,
			queuePath: config.queuePath,
			outbox: outbox ? `${config.lis!.host}:${config.lis!.port}` : 'disabled',
		});
		logStatus(logger, status());

		let stopping: Promise<void> | null = null;
		return {
			queue,
			state,
			forwarder,
			outbox,
			ports: { mllp: mllpPort, health: healthPort },
			status,
			stop() {
				stopping ??= (async () => {
					logger.info('connector.stopping');
					if (statusTimer) {
						clearInterval(statusTimer);
					}
					// Stop taking new messages first, then let the workers finish the send in progress.
					await mllp.close();
					await Promise.all([forwarder.stop(), outbox?.stop()]);
					if (health) {
						health.closeAllConnections();
						await new Promise<void>((resolve) => health!.close(() => resolve()));
					}
					logStatus(logger, status());
					queue.close();
					logger.info('connector.stopped');
				})();
				return stopping;
			},
		};
	} catch (error) {
		await mllp.close(0).catch(() => {});
		health?.close();
		queue.close();
		throw error;
	}
}

function logStatus(logger: Logger, status: ConnectorStatus): void {
	logger.info('connector.status', {
		status: status.status,
		pending: status.queue.pending,
		failed: status.queue.failed,
		delivered: status.queue.delivered,
		oldestPendingMs: status.queue.oldestPendingMs,
		lastHubSuccessAt: status.lastHubSuccessAt,
		lastDeliveredAt: iso(status.queue.lastDeliveredAt),
	});
}

function iso(ms: number | null): string | null {
	return ms === null ? null : new Date(ms).toISOString();
}
