import { describe, expect, it } from 'vitest';

import { OrderStatus } from '../../generated/prisma/enums.js';
import { canTransition, ORDER_TRANSITIONS, transitionRefusal } from './order-status.js';

describe('order status machine', () => {
	it('walks the happy path draft → sent → accepted → collected → resulted → reviewed', () => {
		const path: OrderStatus[] = ['draft', 'sent', 'accepted', 'collected', 'resulted', 'reviewed'];
		for (let i = 1; i < path.length; i++) {
			expect(canTransition(path[i - 1], path[i])).toBe(true);
		}
	});

	it('lets the lab reject only an order it has not accepted', () => {
		expect(canTransition('sent', 'rejected')).toBe(true);
		expect(canTransition('accepted', 'rejected')).toBe(false);
		expect(canTransition('collected', 'rejected')).toBe(false);
	});

	it('lets the orderer cancel until the specimen is collected', () => {
		expect(canTransition('sent', 'cancelled')).toBe(true);
		expect(canTransition('accepted', 'cancelled')).toBe(true);
		expect(canTransition('collected', 'cancelled')).toBe(false);
		expect(canTransition('resulted', 'cancelled')).toBe(false);
	});

	it('accepts a result from a lab that skipped the worklist steps', () => {
		expect(canTransition('sent', 'resulted')).toBe(true);
		expect(canTransition('accepted', 'resulted')).toBe(true);
		expect(canTransition('draft', 'resulted')).toBe(false);
	});

	it('refuses skipping, going back and leaving a closed order; a late result reopens review', () => {
		expect(canTransition('sent', 'collected')).toBe(false);
		expect(canTransition('collected', 'accepted')).toBe(false);
		expect(canTransition('sent', 'reviewed')).toBe(false);
		expect(canTransition('reviewed', 'resulted')).toBe(true);
		for (const closed of ['cancelled', 'rejected'] as const) {
			expect(ORDER_TRANSITIONS[closed]).toEqual([]);
		}
	});

	it('names every status', () => {
		for (const status of Object.values(OrderStatus)) {
			expect(ORDER_TRANSITIONS[status]).toBeDefined();
		}
		expect(transitionRefusal('collected', 'accept')).toBe("This order is collected; it can't be accepted now.");
	});
});
