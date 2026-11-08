import { describe, expect, it } from 'vitest';
import { appointmentSummary, minutesSince, nowIndex, queueSummary } from './queue-summary';

const now = new Date('2026-11-08T06:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe('minutesSince', () => {
	it('rounds to whole minutes and never goes negative', () => {
		expect(minutesSince(ago(12.4), now)).toBe(12);
		expect(minutesSince(ago(-5), now)).toBe(0);
	});
});

describe('queueSummary', () => {
	it('counts each status and finds the longest wait among the waiting', () => {
		expect(
			queueSummary(
				[
					{ status: 'WAITING', issuedAt: ago(10) },
					{ status: 'WAITING', issuedAt: ago(45) },
					{ status: 'CALLED', issuedAt: ago(90) },
					{ status: 'SERVING', issuedAt: ago(5) },
					{ status: 'SKIPPED', issuedAt: ago(5) },
					{ status: 'DONE', issuedAt: ago(200) },
					{ status: 'CANCELLED', issuedAt: ago(300) },
				],
				now,
			),
		).toEqual({ waiting: 2, atDesk: 2, notHere: 1, done: 1, longestWait: 45 });
	});

	it('has no longest wait when nobody waits', () => {
		expect(queueSummary([], now).longestWait).toBeNull();
	});
});

describe('appointmentSummary', () => {
	it('groups bookings by where they stand and leaves cancelled and moved ones out', () => {
		expect(
			appointmentSummary([
				{ status: 'SCHEDULED' },
				{ status: 'CONFIRMED' },
				{ status: 'ARRIVED' },
				{ status: 'IN_PROGRESS' },
				{ status: 'COMPLETED' },
				{ status: 'NO_SHOW' },
				{ status: 'CANCELLED' },
				{ status: 'RESCHEDULED' },
			]),
		).toEqual({ toCome: 2, here: 2, seen: 1, noShow: 1 });
	});
});

describe('nowIndex', () => {
	it('is the first start at or after now, or the length when all are past', () => {
		const starts = [ago(60), ago(1), ago(-10), ago(-60)];
		expect(nowIndex(starts, now)).toBe(2);
		expect(nowIndex([ago(5)], now)).toBe(1);
		expect(nowIndex([], now)).toBe(0);
	});
});
