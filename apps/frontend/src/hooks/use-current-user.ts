import { useQuery } from '@apollo/client/react';

import { MeDocument } from '@/graphql/generated/graphql';

/** The signed-in user from apps/api (`me`). */
export function useCurrentUser({ skip = false }: { skip?: boolean } = {}) {
	const { data, loading, error } = useQuery(MeDocument, { skip });
	return { data: data?.me, isPending: loading && !data, error };
}
