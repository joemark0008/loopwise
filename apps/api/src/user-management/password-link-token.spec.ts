import { describe, expect, it } from 'vitest';

import {
	buildPasswordLinkUrl,
	generatePasswordLinkToken,
	PASSWORD_LINK_PREFIX,
	passwordLinkIdentifier,
} from './password-link-token.js';

describe('password link tokens', () => {
	it('are random and URL-safe', () => {
		const a = generatePasswordLinkToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(generatePasswordLinkToken()).not.toBe(a);
	});

	it('are stored as a stable hash, never as themselves', () => {
		const token = generatePasswordLinkToken();
		const identifier = passwordLinkIdentifier(token);
		expect(identifier.startsWith(PASSWORD_LINK_PREFIX)).toBe(true);
		expect(identifier).not.toContain(token);
		expect(passwordLinkIdentifier(token)).toBe(identifier);
	});

	it('build the set-password URL on the app origin', () => {
		expect(buildPasswordLinkUrl('https://loopwise.example.com/', 'a-b_c')).toBe(
			'https://loopwise.example.com/set-password?token=a-b_c',
		);
	});
});
