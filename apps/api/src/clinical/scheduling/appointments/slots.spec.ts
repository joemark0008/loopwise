import { describe, expect, it } from 'vitest';

import { manilaAt, manilaClock, manilaDate, weekday } from '../manila-time.js';
import { buildSlots } from './slots.js';

const DAY = '2026-11-09'; // a Monday
const session = (start: string, end: string, slotMinutes = 30, maxPatients: number | null = null) => ({
	practitionerId: 'p1',
	clinicId: 'c1',
	start: manilaAt(DAY, start),
	end: manilaAt(DAY, end),
	slotMinutes,
	maxPatients,
});
const before = new Date('2026-11-01T00:00:00Z');

describe('buildSlots', () => {
	it('cuts each session into whole slots, Manila time', () => {
		const slots = buildSlots([session('09:00', '10:45')], [], before);
		expect(slots.map((slot) => manilaClock(slot.start))).toEqual(['09:00', '09:30', '10:00']);
		expect(slots.every((slot) => slot.status === 'OPEN')).toBe(true);
	});

	it('marks a slot with a booking BOOKED, and past slots PAST', () => {
		const slots = buildSlots(
			[session('09:00', '10:00')],
			[{ start: manilaAt(DAY, '09:30') }],
			manilaAt(DAY, '09:10'),
		);
		expect(slots.map((slot) => slot.status)).toEqual(['PAST', 'BOOKED']);
	});

	it('fills the rest of a session once it holds max_patients', () => {
		const slots = buildSlots(
			[session('09:00', '11:00', 30, 2)],
			[{ start: manilaAt(DAY, '09:00') }, { start: manilaAt(DAY, '10:00') }],
			before,
		);
		expect(slots.map((slot) => slot.status)).toEqual(['BOOKED', 'FULL', 'BOOKED', 'FULL']);
	});

	it('keeps two sessions apart, each with its own cap', () => {
		const slots = buildSlots(
			[session('14:00', '15:00', 30, 1), session('09:00', '10:00', 30, 1)],
			[{ start: manilaAt(DAY, '09:00') }],
			before,
		);
		expect(slots.map((slot) => `${manilaClock(slot.start)} ${slot.status}`)).toEqual([
			'09:00 BOOKED',
			'09:30 FULL',
			'14:00 OPEN',
			'14:30 OPEN',
		]);
	});
});

describe('Manila dates', () => {
	it('reads the calendar day and weekday in the Philippines', () => {
		expect(manilaDate(new Date('2026-11-08T16:30:00Z'))).toBe('2026-11-09');
		expect(weekday(DAY)).toBe(1);
		expect(manilaAt(DAY, '09:00').toISOString()).toBe('2026-11-09T01:00:00.000Z');
		expect(manilaAt(DAY, new Date('1970-01-01T14:30:00Z')).toISOString()).toBe('2026-11-09T06:30:00.000Z');
	});
});
