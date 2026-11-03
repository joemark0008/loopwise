import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

import { getActiveOrganizationId } from './active-organization';
import { getProjectRequestHeaders } from './active-project';

/** Sends the selected project and organization, like the tRPC client, so `@ProjectAccess()` resolves them. */
const selectionHeadersLink = new SetContextLink((prevContext) => {
	const activeOrganizationId = getActiveOrganizationId();
	return {
		headers: {
			...prevContext.headers,
			...getProjectRequestHeaders(),
			...(activeOrganizationId ? { 'x-quarry-organization-id': activeOrganizationId } : {}),
		},
	};
});

/** GraphQL client for apps/api (`/graphql`, proxied by Vite). The session cookie authenticates requests. */
export const apolloClient = new ApolloClient({
	link: ApolloLink.from([selectionHeadersLink, new HttpLink({ uri: '/graphql', credentials: 'include' })]),
	cache: new InMemoryCache({
		typePolicies: {
			// Singletons without an id.
			PublicConfig: { keyFields: [] },
			AppVersion: { keyFields: [] },
			UpdateCheck: { keyFields: [] },
		},
	}),
	defaultOptions: {
		watchQuery: { fetchPolicy: 'cache-first' },
	},
});

/** Drops every cached result: call on sign-in and sign-out, since results depend on the user. */
export async function clearApolloCache(): Promise<void> {
	await apolloClient.clearStore();
}
