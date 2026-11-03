import { createHash, randomBytes } from 'node:crypto';

/** Every facility key starts with this, so a leaked one is easy to recognise in logs and secret scanners. */
export const FACILITY_KEY_PREFIX = 'lw_';

/** Characters of the key kept in clear (`keyPrefix`) so admins can tell keys apart. */
const DISPLAY_PREFIX_LENGTH = 10;

export interface IssuedFacilityKey {
	key: string;
	keyHash: string;
	keyPrefix: string;
}

export function hashFacilityKey(key: string): string {
	return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** A new random key (`lw_` + 32 bytes base64url). Only its sha256 hash is stored. */
export function generateFacilityKey(): IssuedFacilityKey {
	return describeFacilityKey(`${FACILITY_KEY_PREFIX}${randomBytes(32).toString('base64url')}`);
}

/** Hash and display prefix of a given key (also used by the seed for its fixed dev key). */
export function describeFacilityKey(key: string): IssuedFacilityKey {
	return { key, keyHash: hashFacilityKey(key), keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** The key from an `Authorization: Bearer lw_…` header, or null. */
export function readBearerFacilityKey(header: string | string[] | undefined): string | null {
	const value = Array.isArray(header) ? header[0] : header;
	const match = /^Bearer\s+(\S+)\s*$/i.exec(value ?? '');
	return match && match[1].startsWith(FACILITY_KEY_PREFIX) ? match[1] : null;
}
