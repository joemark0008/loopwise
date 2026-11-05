import crypto from 'node:crypto';

/** Last timestamp and sequence handed out, so ids from one process sort in creation order (RFC 9562 §6.2, method 1). */
let lastMs = 0;
let sequence = 0;

/**
 * A UUIDv7 (RFC 9562): 48 bits of Unix milliseconds, then a 12-bit sequence and 62 random bits. Every table's id is a
 * UUID (`@default(uuid(7))`); use this when the app generates the id itself and the order matters (better-auth rows,
 * ids handed out before an insert). `crypto.randomUUID()` is fine when it doesn't.
 */
export function uuidv7(now: number = Date.now()): string {
	if (now > lastMs) {
		lastMs = now;
		sequence = crypto.randomInt(0, 0x800); // leave headroom so the sequence rarely overflows within a millisecond
	} else {
		sequence += 1;
		if (sequence > 0xfff) {
			// Out of sequence numbers in this millisecond: borrow the next one, which keeps the order.
			lastMs += 1;
			sequence = 0;
		}
	}

	const bytes = crypto.randomBytes(16);
	const ms = lastMs;
	bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
	bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
	bytes[2] = (ms >>> 24) & 0xff;
	bytes[3] = (ms >>> 16) & 0xff;
	bytes[4] = (ms >>> 8) & 0xff;
	bytes[5] = ms & 0xff;
	bytes[6] = 0x70 | ((sequence >>> 8) & 0x0f); // version 7
	bytes[7] = sequence & 0xff;
	bytes[8] = 0x80 | (bytes[8]! & 0x3f); // variant 10

	const hex = bytes.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether `value` is a UUID string (any version): ids from clients are checked before they reach a `uuid` column. */
export function isUuid(value: unknown): value is string {
	return typeof value === 'string' && UUID_PATTERN.test(value);
}
