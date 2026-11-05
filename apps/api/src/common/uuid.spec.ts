import { describe, expect, it } from 'vitest';

import { isUuid, uuidv7 } from './uuid.js';

describe('uuidv7', () => {
	it('is a version 7, variant 10 UUID carrying the timestamp', () => {
		const now = Date.UTC(2026, 10, 5, 8, 30);
		const id = uuidv7(now);
		expect(isUuid(id)).toBe(true);
		expect(id[14]).toBe('7');
		expect(['8', '9', 'a', 'b']).toContain(id[19]);
		expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBeGreaterThanOrEqual(now);
	});

	it('sorts in creation order, also within one millisecond', () => {
		const now = Date.now() + 60_000;
		const ids = Array.from({ length: 5000 }, () => uuidv7(now));
		expect([...ids].sort()).toEqual(ids);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('isUuid', () => {
	it('accepts UUIDs and rejects anything else', () => {
		expect(isUuid(crypto.randomUUID())).toBe(true);
		expect(isUuid('hc')).toBe(false);
		expect(isUuid(42)).toBe(false);
	});
});
