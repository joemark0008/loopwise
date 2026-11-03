/**
 * Links that depend on the deployment, set at build time (`VITE_LOOPWISE_*`). Upstream hard-coded its own
 * docs, support address, repository and community; loopwise has none of those yet, so an unset link hides
 * the UI that would point to it.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const LOOPWISE_DOCS_URL = env.VITE_LOOPWISE_DOCS_URL?.replace(/\/+$/, '') || undefined;
export const LOOPWISE_SUPPORT_EMAIL = env.VITE_LOOPWISE_SUPPORT_EMAIL || undefined;
export const LOOPWISE_REPOSITORY_URL = env.VITE_LOOPWISE_REPOSITORY_URL?.replace(/\/+$/, '') || undefined;
export const LOOPWISE_COMMUNITY_URL = env.VITE_LOOPWISE_COMMUNITY_URL || undefined;
export const LOOPWISE_NEWSLETTER_SUBSCRIBE_URL = env.VITE_LOOPWISE_NEWSLETTER_SUBSCRIBE_URL || undefined;
export const LOOPWISE_PRIVACY_URL = env.VITE_LOOPWISE_PRIVACY_URL || undefined;

/** A page of the loopwise docs, or undefined when no docs URL is configured. */
export function docsUrl(path: string): string | undefined {
	return LOOPWISE_DOCS_URL ? `${LOOPWISE_DOCS_URL}/${path.replace(/^\/+/, '')}` : undefined;
}
