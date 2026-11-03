import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/** Port of upstream `utils/encryption.ts`. The key is derived from the app secret (`BETTER_AUTH_SECRET`). */
function getKey(secret: string): Buffer {
	return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string with AES-256-GCM. Output format is `iv.tag.ciphertext`, each part base64url-encoded.
 * Use for secrets that must be readable later (warehouse credentials, OAuth tokens), unlike one-way hashing.
 */
export function encryptSecret(plaintext: string, secret: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(ALGORITHM, getKey(secret), iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string, secret: string): string {
	const [ivPart, tagPart, dataPart] = payload.split('.');
	if (!ivPart || !tagPart || !dataPart) {
		throw new Error('Invalid encrypted payload');
	}
	const decipher = crypto.createDecipheriv(ALGORITHM, getKey(secret), Buffer.from(ivPart, 'base64url'));
	decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
	return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}
