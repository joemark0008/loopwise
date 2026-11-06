import { describe, expect, it } from 'vitest';

import { expiresIn, formatDate, manilaToday, numberOrNull, signedQty } from './pharmacy-format';

describe('pharmacy format', () => {
	it('signs ledger quantities', () => {
		expect(signedQty(200)).toBe('+200');
		expect(signedQty(-21)).toBe('−21');
		expect(signedQty(-2.5)).toBe('−2.5');
	});

	it('says when a lot expires', () => {
		expect(expiresIn(40)).toBe('Expires in 40 days');
		expect(expiresIn(1)).toBe('Expires in 1 day');
		expect(expiresIn(0)).toBe('Expires today');
		expect(expiresIn(-20)).toBe('Expired 20 days ago');
		expect(expiresIn(null)).toBe('No expiry');
	});

	it('reads dates and numbers', () => {
		expect(formatDate('2027-01-12')).toBe('Jan 12, 2027');
		expect(formatDate(null)).toBe('—');
		expect(numberOrNull(' ')).toBeNull();
		expect(numberOrNull('2.5')).toBe(2.5);
		expect(numberOrNull('x')).toBeNull();
		expect(manilaToday(new Date('2026-11-05T16:30:00Z'))).toBe('2026-11-06');
	});
});
