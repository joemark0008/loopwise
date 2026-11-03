import { useQuery } from '@apollo/client/react';

import type { PublicConfigQuery } from '@/graphql/generated/graphql';
import { PublicConfigDocument } from '@/graphql/generated/graphql';
import { apolloClient } from '@/lib/apollo-client';

/**
 * The public config from apps/api, in the shape the upstream screens read (`config.data?.x`).
 * loopwise has no billing: `cloudBillingEnabled` stays false until the billing UI is removed.
 */
export type PublicConfig = PublicConfigQuery['publicConfig'] & { cloudBillingEnabled: boolean };

function toPublicConfig(data: PublicConfigQuery | undefined): PublicConfig | undefined {
	return data ? { ...data.publicConfig, cloudBillingEnabled: false } : undefined;
}

export function usePublicConfig() {
	const { data, loading, error } = useQuery(PublicConfigDocument);
	return { data: toPublicConfig(data), isPending: loading && !data, isLoading: loading, isSuccess: !!data, error };
}

/** For route loaders (outside React): reads the cached config, fetching it once. */
export async function fetchPublicConfig(): Promise<PublicConfig> {
	const { data } = await apolloClient.query({ query: PublicConfigDocument });
	return toPublicConfig(data)!;
}

/** Whether SMTP is configured (upstream `authConfig.smtp.isSetup`). */
export function useSmtpSetup() {
	const config = usePublicConfig();
	return { data: config.data?.authProviders.smtp, isPending: config.isPending };
}
