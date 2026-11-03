import { createHash, randomBytes } from 'node:crypto';

/** `verification.identifier` prefix of password links; the rest is the token's SHA-256, never the token itself. */
export const PASSWORD_LINK_PREFIX = 'password-link:';

/** A new user has a week to open their invite; a reset link for an existing account lasts a day. */
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** 256 random bits, URL-safe. */
export function generatePasswordLinkToken(): string {
	return randomBytes(32).toString('base64url');
}

/** What the database stores for a token, so a leaked `verification` row cannot be turned back into a link. */
export function passwordLinkIdentifier(token: string): string {
	return `${PASSWORD_LINK_PREFIX}${createHash('sha256').update(token).digest('hex')}`;
}

export function buildPasswordLinkUrl(baseUrl: string, token: string): string {
	return `${baseUrl.replace(/\/+$/, '')}/set-password?token=${encodeURIComponent(token)}`;
}
