import { afterEach, describe, expect, it } from 'vitest';

import { backoffDelay } from '../src/backoff.ts';
import { MessageQueue } from '../src/queue.ts';
import { syntheticOru, tempQueuePath } from './helpers.ts';

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

function openQueue() {
	const { file, cleanup } = tempQueuePath();
	cleanups.push(cleanup);
	return { file, queue: new MessageQueue(file) };
}

const input = (controlId: string, sender = 'LIS|LAB') => ({
	controlId,
	sender,
	messageType: 'ORU^R01',
	body: syntheticOru(controlId),
});

describe('MessageQueue', () => {
	it('keeps pending messages across a restart', () => {
		const { file, queue } = openQueue();
		queue.enqueue(input('A'), 1_000);
		queue.enqueue(input('B'), 1_001);
		queue.close();

		const reopened = new MessageQueue(file);
		cleanups.unshift(() => reopened.close());
		const due = reopened.due(2_000);
		expect(due.map((message) => message.controlId)).toEqual(['A']);
		expect(due[0].body).toBe(syntheticOru('A'));
		expect(reopened.stats(2_000)).toMatchObject({ pending: 2, failed: 0, delivered: 0, oldestPendingMs: 1_000 });
	});

	it('hands out only the oldest pending message per sender', () => {
		const { queue } = openQueue();
		queue.enqueue(input('A1', 'LIS|A'), 0);
		queue.enqueue(input('B1', 'LIS|B'), 0);
		queue.enqueue(input('A2', 'LIS|A'), 0);
		expect(queue.due(0).map((message) => message.controlId)).toEqual(['A1', 'B1']);
		queue.close();
	});

	it('holds a sender behind a message in backoff, but not behind a failed one', () => {
		const { queue } = openQueue();
		const a1 = queue.enqueue(input('A1'), 0);
		queue.enqueue(input('A2'), 0);
		queue.scheduleRetry(a1.id, 'hub down', 5_000);
		expect(queue.due(1_000)).toEqual([]);
		expect(queue.nextAttemptAt()).toBe(5_000);
		queue.markFailed(a1.id, 'hub acknowledged AE', 'AE', 'MSH|...');
		expect(queue.due(1_000).map((message) => message.controlId)).toEqual(['A2']);
		queue.close();
	});

	it('drops the body once delivered and keeps it when failed', () => {
		const { queue } = openQueue();
		const delivered = queue.enqueue(input('D'));
		const failed = queue.enqueue(input('F'));
		queue.markDelivered(delivered.id, 'AA', 'ack', 42);
		queue.markFailed(failed.id, 'hub acknowledged AR', 'AR', 'ack');
		expect(queue.get(delivered.id)).toMatchObject({
			status: 'delivered',
			body: null,
			deliveredAt: 42,
			attempts: 1,
		});
		expect(queue.get(failed.id)).toMatchObject({ status: 'failed', body: syntheticOru('F'), hubAckCode: 'AR' });
		expect(queue.failed().map((message) => message.controlId)).toEqual(['F']);
		expect(queue.requeue(failed.id)).toBe(true);
		expect(queue.get(failed.id)?.status).toBe('pending');
		queue.close();
	});

	it('records outbox deliveries once', () => {
		const { queue } = openQueue();
		queue.recordOutboxDelivery('o1', 'C1', 'AA', 'ack1', 10);
		queue.recordOutboxDelivery('o1', 'C1', 'AE', 'ack2', 20);
		expect(queue.getOutboxDelivery('o1')).toMatchObject({ lisAckCode: 'AA', lisAck: 'ack1', hubAckedAt: null });
		queue.markOutboxAcked('o1', 30);
		expect(queue.getOutboxDelivery('o1')?.hubAckedAt).toBe(30);
		queue.close();
	});
});

describe('backoffDelay', () => {
	it('doubles from the base up to the cap', () => {
		const policy = { baseMs: 1_000, maxMs: 10_000 };
		expect([1, 2, 3, 4, 5, 50].map((attempt) => backoffDelay(attempt, policy))).toEqual([
			1_000, 2_000, 4_000, 8_000, 10_000, 10_000,
		]);
	});
});
