import { createHmac, timingSafeEqual } from 'node:crypto';

/** The install wizard's one-time proof that the person completing setup can read the server log or `.env`. */
export function deriveSetupToken(secret: string): string {
	return createHmac('sha256', secret).update('loopwise-setup-token').digest('hex').slice(0, 32);
}

export function isValidSetupToken(input: string, secret: string): boolean {
	const given = Buffer.from(input.trim());
	const expected = Buffer.from(deriveSetupToken(secret));
	return given.length === expected.length && timingSafeEqual(given, expected);
}
