import { describe, expect, it } from 'vitest';

import { validateSetupEmail, validateSetupName, validateSetupPassword } from '@/feature/auth/setup-validation';

describe('setup form validation', () => {
	it('refuses a blank name and accepts a real one', () => {
		expect(validateSetupName('   ')).toBe('Enter your name.');
		expect(validateSetupName('Ada')).toBeUndefined();
	});

	it('refuses an address that is not an email, ignoring surrounding spaces', () => {
		expect(validateSetupEmail('ada')).toBe('Enter a valid email address.');
		expect(validateSetupEmail('ada@example')).toBe('Enter a valid email address.');
		expect(validateSetupEmail(' Ada@Example.com ')).toBeUndefined();
	});

	it('holds the password to the same 8 to 128 characters as the API', () => {
		expect(validateSetupPassword('1234567')).toBe('Use at least 8 characters.');
		expect(validateSetupPassword('12345678')).toBeUndefined();
		expect(validateSetupPassword('x'.repeat(128))).toBeUndefined();
		expect(validateSetupPassword('x'.repeat(129))).toBe('Use at most 128 characters.');
	});
});
