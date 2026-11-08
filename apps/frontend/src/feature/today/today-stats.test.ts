import { describe, expect, it } from 'vitest';
import { todayByStatus, trendStart, visitsByDay } from './today-stats';

const today = new Date(2026, 10, 8, 15, 30);
const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).toISOString();

describe('visitsByDay', () => {
	it('has one bucket per day, oldest first, ending today', () => {
		const days = visitsByDay([], today, 14);
		expect(days).toHaveLength(14);
		expect(days[0].date).toBe('2026-10-26');
		expect(days.at(-1)?.date).toBe('2026-11-08');
		expect(days.every((day) => day.consultation + day.followUp + day.other === 0)).toBe(true);
	});

	it('counts visits by type on their local day and skips cancelled and out-of-range ones', () => {
		const days = visitsByDay(
			[
				{ startedAt: at(8), type: 'CONSULTATION', status: 'OPEN' },
				{ startedAt: at(8, 23), type: 'FOLLOW_UP', status: 'COMPLETED' },
				{ startedAt: at(8), type: 'DENTAL', status: 'IN_PROGRESS' },
				{ startedAt: at(8), type: 'CONSULTATION', status: 'CANCELLED' },
				{ startedAt: at(1), type: 'CONSULTATION', status: 'COMPLETED' },
				{ startedAt: new Date(2026, 9, 20).toISOString(), type: 'CONSULTATION', status: 'COMPLETED' },
				{ startedAt: at(20), type: 'CONSULTATION', status: 'COMPLETED' },
			],
			today,
			14,
		);
		expect(days.at(-1)).toMatchObject({ consultation: 1, followUp: 1, other: 1 });
		expect(days.find((day) => day.date === '2026-11-01')).toMatchObject({ consultation: 1 });
		// Today and Nov 1; Oct 20 and Nov 20 fall outside the window.
		expect(days.reduce((sum, day) => sum + day.consultation, 0)).toBe(2);
	});
});

describe('trendStart', () => {
	it('is local midnight, days - 1 days back', () => {
		expect(trendStart(today, 14)).toEqual(new Date(2026, 9, 26));
	});
});

describe('todayByStatus', () => {
	it("counts today's visits per status in queue order, zero for the missing ones", () => {
		expect(
			todayByStatus(
				[
					{ startedAt: at(8), type: 'CONSULTATION', status: 'IN_PROGRESS' },
					{ startedAt: at(8), type: 'CONSULTATION', status: 'IN_PROGRESS' },
					{ startedAt: at(8), type: 'CONSULTATION', status: 'CANCELLED' },
					{ startedAt: at(7), type: 'CONSULTATION', status: 'OPEN' },
				],
				today,
			),
		).toEqual([
			{ status: 'OPEN', count: 0 },
			{ status: 'IN_PROGRESS', count: 2 },
			{ status: 'FOR_BILLING', count: 0 },
			{ status: 'COMPLETED', count: 0 },
		]);
	});
});
