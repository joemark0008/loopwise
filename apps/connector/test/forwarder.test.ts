import { afterEach, describe, expect, it } from 'vitest';

import { ConnectorState } from '../src/connector-state.ts';
import { Forwarder } from '../src/forwarder.ts';
import { HubClient } from '../src/hub-client.ts';
import { silentLogger } from '../src/logger.ts';
import { MessageQueue } from '../src/queue.ts';
import { hubAck, startFakeHub, syntheticOru, tempQueuePath } from './helpers.ts';

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});

async function setup(respond: Parameters<typeof startFakeHub>[0]) {
	const hub = await startFakeHub(respond);
	const { file, cleanup } = tempQueuePath();
	const queue = new MessageQueue(file);
	cleanups.push(cleanup, () => queue.close(), hub.close);
	const state = new ConnectorState();
	let now = 1_000_000;
	const forwarder = new Forwarder({
		queue,
		hub: new HubClient({ hubUrl: `${hub.url}/`, facilityKey: 'fk_test', timeoutMs: 2_000 }),
		state,
		logger: silentLogger,
		backoff: { baseMs: 1_000, maxMs: 8_000 },
		now: () => now,
	});
	const enqueue = (controlId: string) =>
		queue.enqueue({ controlId, sender: 'LIS|LAB', messageType: 'ORU^R01', body: syntheticOru(controlId) }, now);
	return { hub, queue, state, forwarder, enqueue, advance: (ms: number) => (now += ms) };
}

describe('Forwarder', () => {
	it('retries a 500 with backoff and delivers once on 200 AA', async () => {
		let calls = 0;
		const { hub, queue, forwarder, enqueue, advance } = await setup((request) => {
			calls += 1;
			return calls === 1 ? { status: 500, body: 'boom' } : { status: 200, body: hubAck(request.body, 'AA') };
		});
		const message = enqueue('C500');

		await forwarder.drain();
		expect(queue.get(message.id)).toMatchObject({ status: 'pending', attempts: 1, lastError: 'hub responded 500' });
		expect(await forwarder.tick()).toBe(1_000);

		advance(999);
		await forwarder.drain();
		expect(hub.requests).toHaveLength(1);

		advance(1);
		await forwarder.drain();
		await forwarder.drain();
		expect(hub.requests).toHaveLength(2);
		expect(queue.get(message.id)).toMatchObject({ status: 'delivered', hubAckCode: 'AA', body: null, attempts: 2 });

		const [request] = hub.requests;
		expect(request).toMatchObject({
			method: 'POST',
			url: '/api/hl7/messages',
			authorization: 'Bearer fk_test',
			body: syntheticOru('C500'),
		});
		expect(request.contentType).toMatch(/^text\/plain/);
	});

	it('stops on 401: no further requests, messages stay queued', async () => {
		const { hub, queue, state, forwarder, enqueue, advance } = await setup(() => ({ status: 401 }));
		const first = enqueue('K1');
		enqueue('K2');
		queue.enqueue({ controlId: 'K3', sender: 'OTHER|LAB', messageType: 'ORU^R01', body: syntheticOru('K3') });

		await forwarder.drain();
		expect(state.halted).toBe(true);
		expect(state.haltReason).toMatch(/401/);
		expect(hub.requests).toHaveLength(1);

		advance(60_000);
		await forwarder.drain();
		expect(hub.requests).toHaveLength(1);
		expect(queue.get(first.id)?.status).toBe('pending');
		expect(queue.stats().pending).toBe(3);
	});

	it('marks a message failed on AE and moves on to the next one', async () => {
		const { hub, queue, forwarder, enqueue } = await setup((request) => ({
			status: 200,
			body: hubAck(request.body, request.body.includes('|BAD|') ? 'AE' : 'AA'),
		}));
		const bad = enqueue('BAD');
		const good = enqueue('GOOD');

		await forwarder.drain();
		expect(queue.get(bad.id)).toMatchObject({ status: 'failed', hubAckCode: 'AE', body: syntheticOru('BAD') });
		expect(queue.get(good.id)?.status).toBe('delivered');
		expect(hub.requests).toHaveLength(2);

		await forwarder.drain();
		expect(hub.requests).toHaveLength(2);
	});

	it('marks a message failed on a 4xx the hub will never accept', async () => {
		const { queue, forwarder, enqueue } = await setup(() => ({ status: 422 }));
		const message = enqueue('U1');
		await forwarder.drain();
		expect(queue.get(message.id)).toMatchObject({ status: 'failed', lastError: 'hub responded 422' });
	});

	it('treats an unreachable hub as transient', async () => {
		const { hub, queue, forwarder, enqueue } = await setup(() => ({ status: 200 }));
		await hub.close();
		const message = enqueue('N1');
		await forwarder.drain();
		expect(queue.get(message.id)).toMatchObject({ status: 'pending', attempts: 1 });
		expect(queue.get(message.id)?.nextAttemptAt).toBe(1_000_000 + 1_000);
	});

	it('treats a 200 without an MSA as transient', async () => {
		const { queue, forwarder, enqueue } = await setup(() => ({ status: 200, body: 'ok' }));
		const message = enqueue('M1');
		await forwarder.drain();
		expect(queue.get(message.id)).toMatchObject({ status: 'pending', attempts: 1 });
	});
});
