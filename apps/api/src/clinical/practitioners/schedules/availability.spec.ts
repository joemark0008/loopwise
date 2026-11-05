import { describe, expect, it } from 'vitest';

import {
	dayOfWeekOf,
	isDateOnly,
	manilaDateOf,
	manilaDayRange,
	overlapsLeave,
	sessionsOn,
	timesOverlap,
	type WeeklySession,
} from './availability.js';

const tuesdayMorning: WeeklySession = {
	id: 's1',
	dayOfWeek: 2,
	startTime: '09:00',
	endTime: '10:00',
	slotMinutes: 15,
	maxPatients: 10,
};

describe('availability', () => {
	it('reads dates and days of week', () => {
		expect(isDateOnly('2026-11-10')).toBe(true);
		expect(isDateOnly('2026-02-30')).toBe(false);
		expect(isDateOnly('10/11/2026')).toBe(false);
		expect(dayOfWeekOf('2026-11-10')).toBe(2);
		expect(manilaDayRange('2026-11-10').from.toISOString()).toBe('2026-11-09T16:00:00.000Z');
		expect(manilaDateOf(new Date('2026-11-09T16:30:00Z'))).toBe('2026-11-10');
	});

	it('cuts a session into slots in Philippine time', () => {
		const [session] = sessionsOn('2026-11-10', [tuesdayMorning], []);
		expect(session.startsAt.toISOString()).toBe('2026-11-10T01:00:00.000Z');
		expect(session.slots).toHaveLength(4);
		expect(session.slots[3].endsAt.toISOString()).toBe('2026-11-10T02:00:00.000Z');
		expect(session.onLeave).toBe(false);
	});

	it('only returns the sessions of that day of week', () => {
		expect(sessionsOn('2026-11-11', [tuesdayMorning], [])).toEqual([]);
	});

	it('drops a last slot that would run past the session', () => {
		const [session] = sessionsOn('2026-11-10', [{ ...tuesdayMorning, slotMinutes: 25 }], []);
		expect(session.slots).toHaveLength(2);
	});

	it('leaves out the slots a leave overlaps', () => {
		const leave = {
			id: 'l1',
			startAt: new Date('2026-11-10T09:30:00+08:00'),
			endAt: new Date('2026-11-10T12:00:00+08:00'),
			reason: 'Conference',
		};
		const [session] = sessionsOn('2026-11-10', [tuesdayMorning], [leave]);
		expect(session.onLeave).toBe(true);
		expect(session.slots.map((slot) => slot.startsAt.toISOString())).toEqual([
			'2026-11-10T01:00:00.000Z',
			'2026-11-10T01:15:00.000Z',
		]);
	});

	it('tells instants and ranges on leave', () => {
		const leave = { startAt: new Date('2026-11-10T00:00:00Z'), endAt: new Date('2026-11-11T00:00:00Z') };
		expect(overlapsLeave(leave, new Date('2026-11-10T00:00:00Z'))).toBe(true);
		expect(overlapsLeave(leave, new Date('2026-11-11T00:00:00Z'))).toBe(false);
		expect(overlapsLeave(leave, new Date('2026-11-09T23:00:00Z'), new Date('2026-11-10T00:30:00Z'))).toBe(true);
		expect(overlapsLeave(leave, new Date('2026-11-09T23:00:00Z'), new Date('2026-11-10T00:00:00Z'))).toBe(false);
	});

	it('finds overlapping times of day', () => {
		expect(timesOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '11:00', endTime: '13:00' })).toBe(
			true,
		);
		expect(timesOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '12:00', endTime: '13:00' })).toBe(
			false,
		);
	});
});
