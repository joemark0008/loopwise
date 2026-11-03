import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret } from './encryption.js';

describe('encryption', () => {
	const secret = 'a-secret-of-at-least-twenty-characters';

	it('round-trips and uses a fresh IV each time', () => {
		const first = encryptSecret('{"password":"p@ss"}', secret);
		expect(first.split('.')).toHaveLength(3);
		expect(encryptSecret('{"password":"p@ss"}', secret)).not.toBe(first);
		expect(decryptSecret(first, secret)).toBe('{"password":"p@ss"}');
	});

	it('rejects a tampered payload or another key', () => {
		const payload = encryptSecret('value', secret);
		const [iv, tag, data] = payload.split('.');
		expect(() => decryptSecret(`${iv}.${tag}.${data}A`, secret)).toThrow();
		expect(() => decryptSecret(payload, 'another-secret-of-twenty-chars')).toThrow();
		expect(() => decryptSecret('not-a-payload', secret)).toThrow('Invalid encrypted payload');
	});
});
