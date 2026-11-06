import { describe, expect, it } from 'vitest';

import { dispensingStatus } from './prescription-dispense-status.js';

describe('dispensingStatus', () => {
	it('stays active until something is dispensed', () => {
		expect(dispensingStatus('ACTIVE', [{ quantity: 21, dispensedQty: 0 }])).toBe('ACTIVE');
	});

	it('is partially dispensed while an item is short', () => {
		expect(
			dispensingStatus('ACTIVE', [
				{ quantity: 21, dispensedQty: 21 },
				{ quantity: 30, dispensedQty: 0 },
			]),
		).toBe('PARTIALLY_DISPENSED');
		expect(dispensingStatus('ACTIVE', [{ quantity: 21, dispensedQty: 10 }])).toBe('PARTIALLY_DISPENSED');
	});

	it('is dispensed once every item is', () => {
		expect(
			dispensingStatus('PARTIALLY_DISPENSED', [
				{ quantity: 21, dispensedQty: 21 },
				{ quantity: 30, dispensedQty: 30 },
			]),
		).toBe('DISPENSED');
	});

	it('leaves cancelled and expired prescriptions alone', () => {
		expect(dispensingStatus('CANCELLED', [{ quantity: 1, dispensedQty: 1 }])).toBe('CANCELLED');
		expect(dispensingStatus('EXPIRED', [{ quantity: 1, dispensedQty: 0 }])).toBe('EXPIRED');
	});
});
