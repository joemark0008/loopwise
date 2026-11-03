import { describe, expect, it } from 'vitest';

import { buildUsernameAllowlist, isEmailDomainAllowed, regexPassword, resolveProviderId } from './auth-utils.js';

describe('buildUsernameAllowlist', () => {
	it('returns an empty set when unset', () => {
		expect(buildUsernameAllowlist(undefined).size).toBe(0);
	});

	it('normalizes entries to lowercase so matching is case-insensitive', () => {
		const allowlist = buildUsernameAllowlist('Alice, BOB , charlie');
		expect(allowlist.has('alice')).toBe(true);
		expect(allowlist.has('Alice')).toBe(false);
		expect(allowlist.has('bob')).toBe(true);
		expect(allowlist.has('charlie')).toBe(true);
	});

	it('drops empty entries produced by stray commas', () => {
		const allowlist = buildUsernameAllowlist('alice,, ,bob');
		expect(allowlist.size).toBe(2);
	});
});

describe('isEmailDomainAllowed', () => {
	it('allows every domain when no domains are configured', () => {
		expect(isEmailDomainAllowed('a@example.com', undefined)).toBe(true);
		expect(isEmailDomainAllowed('a@example.com', '')).toBe(true);
	});

	it('matches configured domains case-insensitively', () => {
		expect(isEmailDomainAllowed('a@Example.com', 'example.com, other.org')).toBe(true);
		expect(isEmailDomainAllowed('a@evil.com', 'example.com')).toBe(false);
		expect(isEmailDomainAllowed('not-an-email', 'example.com')).toBe(false);
	});
});

describe('resolveProviderId', () => {
	it('reads social and generic OAuth provider ids', () => {
		expect(resolveProviderId({ params: { id: 'google' } })).toBe('google');
		expect(resolveProviderId({ params: { providerId: 'okta' } })).toBe('okta');
		expect(resolveProviderId(null)).toBeUndefined();
	});
});

describe('regexPassword', () => {
	it('requires upper, lower, digit, special and 8 characters', () => {
		expect(regexPassword.test('Passw0rd!')).toBe(true);
		expect(regexPassword.test('password')).toBe(false);
		expect(regexPassword.test('Pa0!')).toBe(false);
	});
});
