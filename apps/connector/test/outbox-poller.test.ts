import { afterEach, describe, expect, it } from 'vitest';

import { ConnectorState } from '../src/connector-state.ts';
import { HubClient } from '../src/hub-client.ts';
import { silentLogger } from '../src/logger.ts';
import { OutboxPoller } from '../src/outbox-poller.ts';
import { MessageQueue } from '../src/queue.ts';
import { startFakeHub, startFakeLis, tempQueuePath } from './helpers.ts';

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) {
		await cleanup();
	}
});

/** A synthetic ORM^O01 the hub would queue for the lab. */
const order = (controlId: string) =>
	[
		`MSH|^~\\&|LOOPWISE|HUB|LIS|BOHOL_LAB|20261103080000||ORM^O01^ORM_O01|${controlId}|P|2.5.1`,
		'PID|1||SYN-0001^^^TAG_HC^MR||Testcase^Synthetic||19800101|F',
		'ORC|NW|ORD-1',
		'OBR|1|ORD-1||4548-4^Hemoglobin A1c^LN',
	].join('\r');

async function setup(outbox: { id: string; message: string }[], options: { ackStatus?: () => number } = {}) {
	const pending = [...outbox];
	const hub = await startFakeHub((request) => {
		if (request.method === 'GET' && request.url.startsWith('/api/hl7/outbox')) {
			return { status: 200, body: JSON.stringify(pending), contentType: 'application/json' };
		}
		const match = /^\/api\/hl7\/outbox\/([^/]+)\/ack$/.exec(request.url);
		if (request.method === 'POST' && match) {
			const status = options.ackStatus?.() ?? 200;
			if (status === 200) {
				pending.splice(
					pending.findIndex((item) => item.id === decodeURIComponent(match[1])),
					1,
				);
			}
			return { status, body: '{}', contentType: 'application/json' };
		}
		return { status: 404 };
	});
	const lis = await startFakeLis('AA');
	const { file, cleanup } = tempQueuePath();
	const queue = new MessageQueue(file);
	cleanups.push(cleanup, () => queue.close(), hub.close, lis.close);
	const state = new ConnectorState();
	const poller = new OutboxPoller({
		queue,
		hub: new HubClient({ hubUrl: hub.url, facilityKey: 'fk_test', timeoutMs: 2_000 }),
		state,
		logger: silentLogger,
		lis: { host: '127.0.0.1', port: lis.port, timeoutMs: 2_000 },
		pollMs: 1_000,
	});
	return { hub, lis, queue, state, poller, pending };
}

describe('OutboxPoller', () => {
	it('delivers each order to the LIS and posts the LIS ACK to the hub', async () => {
		const { hub, lis, poller, pending, queue } = await setup([
			{ id: 'o1', message: order('ORM1') },
			{ id: 'o2', message: order('ORM2') },
		]);
		expect(await poller.poll()).toBe(2);
		expect(lis.received).toEqual([order('ORM1'), order('ORM2')]);
		expect(pending).toEqual([]);

		const [poll, ...acks] = hub.requests;
		expect(poll).toMatchObject({ method: 'GET', url: '/api/hl7/outbox?limit=20', authorization: 'Bearer fk_test' });
		expect(acks.map((request) => request.url)).toEqual(['/api/hl7/outbox/o1/ack', '/api/hl7/outbox/o2/ack']);
		const body = JSON.parse(acks[0].body);
		expect(body.code).toBe('AA');
		expect(body.ack).toMatch(/\rMSA\|AA\|ORM1$/);
		expect(queue.getOutboxDelivery('o1')?.hubAckedAt).not.toBeNull();
	});

	it('re-posts a lost hub ack without sending the order to the LIS again', async () => {
		let ackStatus = 503;
		const { lis, poller, pending } = await setup([{ id: 'o1', message: order('ORM1') }], {
			ackStatus: () => ackStatus,
		});
		expect(await poller.poll()).toBe(0);
		expect(lis.received).toHaveLength(1);
		expect(pending).toHaveLength(1);

		ackStatus = 200;
		expect(await poller.poll()).toBe(1);
		expect(lis.received).toHaveLength(1);
		expect(pending).toEqual([]);
	});

	it('leaves orders on the hub while the LIS is unreachable', async () => {
		const { hub, lis, poller, pending } = await setup([{ id: 'o1', message: order('ORM1') }]);
		await lis.close();
		expect(await poller.poll()).toBe(0);
		expect(pending).toHaveLength(1);
		expect(hub.requests.filter((request) => request.method === 'POST')).toEqual([]);
	});

	it('halts on 401', async () => {
		const { hub, poller, state } = await setup([]);
		hub.respond = () => ({ status: 401 });
		await poller.poll();
		expect(state.halted).toBe(true);
		await poller.poll();
		expect(hub.requests).toHaveLength(1);
	});
});
