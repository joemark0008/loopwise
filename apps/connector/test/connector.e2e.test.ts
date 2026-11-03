import net from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.ts';
import { type Connector, startConnector } from '../src/connector.ts';
import { parseAck } from '../src/hl7.ts';
import { createLogger } from '../src/logger.ts';
import { frame, MllpDecoder, mllpSend } from '../src/mllp.ts';
import { MessageQueue } from '../src/queue.ts';
import { hubAck, startFakeHub, syntheticOru, tempQueuePath, waitFor } from './helpers.ts';

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});

async function start(hubUrl: string, queuePath: string, logLines: string[] = []): Promise<Connector> {
	const config = loadConfig({
		HUB_URL: hubUrl,
		FACILITY_KEY: 'fk_test',
		MLLP_HOST: '127.0.0.1',
		MLLP_PORT: '0',
		HEALTH_PORT: '0',
		QUEUE_PATH: queuePath,
		RETRY_BASE_MS: '20',
		RETRY_MAX_MS: '100',
		STATUS_LOG_MS: '0',
	});
	const connector = await startConnector(config, { logger: createLogger('debug', (line) => logLines.push(line)) });
	cleanups.push(() => connector.stop());
	return connector;
}

const send = (port: number, message: string) => mllpSend(message, { host: '127.0.0.1', port, timeoutMs: 2_000 });

describe('connector end to end (TCP MLLP → connector → HTTP hub)', () => {
	it('acks the LIS after queueing, forwards to the hub, and never logs the body', async () => {
		const hub = await startFakeHub((request) => ({ status: 200, body: hubAck(request.body, 'AA') }));
		cleanups.push(hub.close);
		const { file, cleanup } = tempQueuePath();
		cleanups.push(cleanup);
		const logs: string[] = [];
		const connector = await start(hub.url, file, logs);

		const ack = await send(connector.ports.mllp, syntheticOru('E2E1'));
		expect(parseAck(ack)).toMatchObject({ code: 'AA', controlId: 'E2E1' });

		await waitFor(() => connector.queue.stats().delivered === 1);
		expect(hub.requests).toHaveLength(1);
		expect(hub.requests[0].body).toBe(syntheticOru('E2E1'));

		const health = await fetch(`http://127.0.0.1:${connector.ports.health}/health`);
		expect(health.status).toBe(200);
		expect(await health.json()).toMatchObject({ status: 'ok', queue: { pending: 0, delivered: 1 } });

		const allLogs = logs.join('\n');
		expect(allLogs).toContain('E2E1');
		expect(allLogs).not.toContain('Testcase');
		expect(allLogs).not.toContain('SYN-0001');
	});

	it('handles several messages on one connection, joined in one write, and rejects non-HL7 with AR', async () => {
		const hub = await startFakeHub((request) => ({ status: 200, body: hubAck(request.body, 'AA') }));
		cleanups.push(hub.close);
		const { file, cleanup } = tempQueuePath();
		cleanups.push(cleanup);
		const connector = await start(hub.url, file);

		const acks = await new Promise<string[]>((resolve, reject) => {
			const socket = net.createConnection({ host: '127.0.0.1', port: connector.ports.mllp });
			const decoder = new MllpDecoder();
			const received: string[] = [];
			socket.on('data', (chunk) => {
				received.push(...decoder.push(chunk));
				if (received.length === 3) {
					socket.end();
					resolve(received);
				}
			});
			socket.on('error', reject);
			// Messages joined in one write, the second split mid-frame across two writes.
			const bytes = Buffer.concat([frame(syntheticOru('J1')), frame('garbage'), frame(syntheticOru('J2'))]);
			socket.write(bytes.subarray(0, bytes.length - 20));
			setTimeout(() => socket.write(bytes.subarray(bytes.length - 20)), 20);
		});
		expect(acks.map((ack) => parseAck(ack)?.code)).toEqual(['AA', 'AR', 'AA']);
		expect(acks.map((ack) => parseAck(ack)?.controlId)).toEqual(['J1', '', 'J2']);
		await waitFor(() => connector.queue.stats().delivered === 2);
		expect(hub.requests.map((request) => request.body)).toEqual([syntheticOru('J1'), syntheticOru('J2')]);
	});

	it('buffers while the hub is down and delivers after a restart', async () => {
		let up = false;
		const hub = await startFakeHub((request) =>
			up ? { status: 200, body: hubAck(request.body, 'AA') } : { status: 503 },
		);
		cleanups.push(hub.close);
		const { file, cleanup } = tempQueuePath();
		cleanups.push(cleanup);

		const first = await start(hub.url, file);
		expect(parseAck(await send(first.ports.mllp, syntheticOru('R1')))?.code).toBe('AA');
		await waitFor(() => hub.requests.length >= 1);
		await first.stop();

		const stored = new MessageQueue(file);
		expect(stored.stats()).toMatchObject({ pending: 1, delivered: 0 });
		stored.close();

		up = true;
		const second = await start(hub.url, file);
		await waitFor(() => second.queue.stats().delivered === 1);
		expect(hub.requests.at(-1)?.body).toBe(syntheticOru('R1'));
	});

	it('reports halted (503) on /health after the hub rejects the key', async () => {
		const hub = await startFakeHub(() => ({ status: 401 }));
		cleanups.push(hub.close);
		const { file, cleanup } = tempQueuePath();
		cleanups.push(cleanup);
		const connector = await start(hub.url, file);

		expect(parseAck(await send(connector.ports.mllp, syntheticOru('H1')))?.code).toBe('AA');
		await waitFor(() => connector.state.halted);
		const health = await fetch(`http://127.0.0.1:${connector.ports.health}/health`);
		expect(health.status).toBe(503);
		expect(await health.json()).toMatchObject({ status: 'halted', queue: { pending: 1 } });
	});
});
