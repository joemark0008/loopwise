import type { IncomingHttpHeaders } from 'node:http';

/** Ported from upstream `utils/utils.ts`: the helpers the auth module uses. */

export const convertHeaders = (headers: IncomingHttpHeaders) => {
	const convertedHeaders = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (value) {
			convertedHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
		}
	}
	return convertedHeaders;
};

export const buildUsernameAllowlist = (allowedUsers?: string): Set<string> => {
	const allowed = new Set<string>();
	if (allowedUsers) {
		for (const username of allowedUsers.split(',')) {
			const trimmed = username.trim().toLowerCase();
			if (trimmed) {
				allowed.add(trimmed);
			}
		}
	}
	return allowed;
};

export const isEmailDomainAllowed = (userEmail: string, authDomains?: string) => {
	if (authDomains) {
		const allowedDomains = authDomains.split(',').map((domain) => domain.trim().toLowerCase());
		const userEmailDomain = userEmail.split('@').at(1)?.toLowerCase();
		if (!userEmailDomain) {
			return false;
		}
		return allowedDomains.includes(userEmailDomain);
	}
	return true;
};

/**
 * Resolve the auth provider ID from the better-auth callback context.
 * Social providers use `params.id`, the genericOAuth plugin (OIDC) uses `params.providerId`.
 */
export function resolveProviderId(ctx?: { params?: Record<string, string | undefined> } | null): string | undefined {
	return ctx?.params?.id ?? ctx?.params?.providerId;
}

export const regexPassword = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;
