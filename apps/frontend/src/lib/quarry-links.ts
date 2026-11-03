/**
 * Links that depend on the deployment, set at build time (`VITE_QUARRY_*`). Upstream hard-coded its own
 * docs, support address, repository and community; quarry has none of those yet, so an unset link hides
 * the UI that would point to it.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const QUARRY_DOCS_URL = env.VITE_QUARRY_DOCS_URL?.replace(/\/+$/, '') || undefined;
export const QUARRY_SUPPORT_EMAIL = env.VITE_QUARRY_SUPPORT_EMAIL || undefined;
export const QUARRY_REPOSITORY_URL = env.VITE_QUARRY_REPOSITORY_URL?.replace(/\/+$/, '') || undefined;
export const QUARRY_COMMUNITY_URL = env.VITE_QUARRY_COMMUNITY_URL || undefined;
export const QUARRY_NEWSLETTER_SUBSCRIBE_URL = env.VITE_QUARRY_NEWSLETTER_SUBSCRIBE_URL || undefined;
export const QUARRY_PRIVACY_URL = env.VITE_QUARRY_PRIVACY_URL || undefined;

/** A page of the quarry docs, or undefined when no docs URL is configured. */
export function docsUrl(path: string): string | undefined {
	return QUARRY_DOCS_URL ? `${QUARRY_DOCS_URL}/${path.replace(/^\/+/, '')}` : undefined;
}
