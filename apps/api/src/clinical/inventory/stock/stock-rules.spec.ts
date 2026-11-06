import { describe, expect, it } from 'vitest';

import {
	daysUntil,
	isExpired,
	isLowStock,
	lotAlert,
	manilaToday,
	type PickableLot,
	pickFefo,
	usableQuantity,
} from './stock-rules.js';

const TODAY = '2026-11-06';

function lot(id: string, expiryDate: string | null, quantityOnHand: number, receivedDay = 1): PickableLot {
	return { id, lotNo: id.toUpperCase(), expiryDate, quantityOnHand, receivedAt: new Date(2026, 0, receivedDay) };
}

describe('stock rules', () => {
	it('reads the calendar day in Manila', () => {
		expect(manilaToday(new Date('2026-11-05T16:30:00Z'))).toBe('2026-11-06');
		expect(manilaToday(new Date('2026-11-05T15:59:00Z'))).toBe('2026-11-05');
	});

	it('treats a lot as expired from its expiry date on', () => {
		expect(isExpired('2026-11-06', TODAY)).toBe(true);
		expect(isExpired('2026-11-07', TODAY)).toBe(false);
		expect(isExpired(null, TODAY)).toBe(false);
		expect(daysUntil('2026-12-06', TODAY)).toBe(30);
	});

	it('picks first expiry first out and never an expired lot', () => {
		const lots = [lot('late', '2027-06-30', 50), lot('expired', '2026-10-31', 100), lot('soon', '2026-12-31', 10)];
		expect(pickFefo(lots, 15, TODAY)).toEqual([
			{ lotId: 'soon', lotNo: 'SOON', quantity: 10 },
			{ lotId: 'late', lotNo: 'LATE', quantity: 5 },
		]);
		expect(pickFefo(lots, 8, TODAY)).toEqual([{ lotId: 'soon', lotNo: 'SOON', quantity: 8 }]);
	});

	it('returns null when the unexpired stock is short', () => {
		expect(pickFefo([lot('a', '2026-12-31', 5), lot('old', '2026-01-01', 100)], 6, TODAY)).toBeNull();
		expect(usableQuantity([lot('a', '2026-12-31', 5), lot('old', '2026-01-01', 100)], TODAY)).toBe(5);
	});

	it('takes lots without an expiry last, then the oldest delivery', () => {
		const lots = [lot('none', null, 5, 1), lot('newer', '2027-01-31', 5, 9), lot('older', '2027-01-31', 5, 2)];
		expect(pickFefo(lots, 12, TODAY)?.map((pick) => pick.lotId)).toEqual(['older', 'newer', 'none']);
	});

	it('flags expired and expiring lots that still hold stock', () => {
		expect(lotAlert({ expiryDate: '2026-11-01', quantityOnHand: 3 }, TODAY)).toBe('EXPIRED');
		expect(lotAlert({ expiryDate: '2027-01-15', quantityOnHand: 3 }, TODAY)).toBe('EXPIRING');
		expect(lotAlert({ expiryDate: '2027-06-30', quantityOnHand: 3 }, TODAY)).toBeNull();
		expect(lotAlert({ expiryDate: '2026-11-01', quantityOnHand: 0 }, TODAY)).toBeNull();
		expect(lotAlert({ expiryDate: '2026-11-20', quantityOnHand: 3 }, TODAY, 7)).toBeNull();
	});

	it('flags low stock at or below the reorder level', () => {
		expect(isLowStock(20, 20)).toBe(true);
		expect(isLowStock(21, 20)).toBe(false);
		expect(isLowStock(0, null)).toBe(false);
	});
});
