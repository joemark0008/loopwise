import { describe, expect, it } from 'vitest';

import { deriveSetupToken, isValidSetupToken } from './setup-token.js';

describe('setup token', () => {
	it('is stable for one secret and differs between secrets', () => {
		expect(deriveSetupToken('a')).toBe(deriveSetupToken('a'));
		expect(deriveSetupToken('a')).not.toBe(deriveSetupToken('b'));
		expect(deriveSetupToken('a')).toMatch(/^[0-9a-f]{32}$/);
	});

	it('accepts the token with surrounding whitespace', () => {
		expect(isValidSetupToken(`  ${deriveSetupToken('a')}\n`, 'a')).toBe(true);
	});

	it('refuses a wrong token, a wrong length and multi-byte input without throwing', () => {
		expect(isValidSetupToken('0'.repeat(32), 'a')).toBe(false);
		expect(isValidSetupToken('abc', 'a')).toBe(false);
		expect(isValidSetupToken('é'.repeat(32), 'a')).toBe(false);
	});
});
