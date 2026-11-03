import { describe, expect, it } from 'vitest';

import { byPriorityThenAge, waitingFor } from './order-format';
import { staffRoleOf } from '@/hooks/use-staff-role';

describe('order format', () => {
	it('sorts STAT first, then urgent, then routine, oldest first within each', () => {
		const orders = [
			{ id: 'routine-old', priority: 'routine', sentAt: '2026-11-06T01:00:00Z', createdAt: '' },
			{ id: 'urgent', priority: 'urgent', sentAt: '2026-11-06T03:00:00Z', createdAt: '' },
			{ id: 'stat', priority: 'stat', sentAt: '2026-11-06T04:00:00Z', createdAt: '' },
			{ id: 'routine-new', priority: 'routine', sentAt: '2026-11-06T02:00:00Z', createdAt: '' },
		] as const;
		expect(byPriorityThenAge(orders).map((order) => order.id)).toEqual([
			'stat',
			'urgent',
			'routine-old',
			'routine-new',
		]);
	});

	it('says how long an order has waited', () => {
		const now = new Date('2026-11-06T12:00:00Z');
		expect(waitingFor('2026-11-06T11:48:00Z', now)).toBe('12 min');
		expect(waitingFor('2026-11-06T09:00:00Z', now)).toBe('3 h');
		expect(waitingFor('2026-11-04T09:00:00Z', now)).toBe('2 d');
		expect(waitingFor('2026-11-06T12:05:00Z', now)).toBe('0 min');
	});
});

describe('staff role', () => {
	it('is lab when every facility is a lab or imaging center, doctor otherwise', () => {
		expect(staffRoleOf([{ type: 'lab' }])).toBe('lab');
		expect(staffRoleOf([{ type: 'lab' }, { type: 'imaging' }])).toBe('lab');
		expect(staffRoleOf([{ type: 'lab' }, { type: 'clinic' }])).toBe('doctor');
		expect(staffRoleOf([{ type: 'hospital' }])).toBe('doctor');
		expect(staffRoleOf([])).toBe('doctor');
	});
});
