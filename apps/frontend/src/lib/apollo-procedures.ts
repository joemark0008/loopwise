import { CombinedGraphQLErrors } from '@apollo/client';
import { skipToken } from '@tanstack/react-query';
import type { DocumentNode, TypedDocumentNode } from '@apollo/client';
import type {
	DataTag,
	QueryFunction,
	QueryKey,
	SkipToken,
	UseMutationOptions,
	UseQueryOptions,
} from '@tanstack/react-query';

import { apolloClient } from '@/lib/apollo-client';

/**
 * Builders for the apps/api procedures, shaped like upstream's tRPC options proxy (`queryOptions`, `queryKey`,
 * `mutationOptions`, `pathFilter`), which the frontend was written against.
 *
 * Requests go through Apollo Client without its cache; results stay in TanStack Query (the chat view rewrites
 * its cached chat on every streamed chunk). Query keys keep tRPC's `[path, { input, type }]` shape so prefix
 * invalidations such as `[['chat', 'listGrouped']]` keep working.
 */
/** `[router, procedure]`, or deeper to nest a query under another one's invalidations. */
type Path = readonly [string, string, ...string[]];

/** tRPC's `queryKey(input)` takes a partial input, for prefix invalidations (`{ chatId, storySlug }` of every version). */
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export function query<TInput, TOutput>(path: Path, fetch: (input: TInput) => Promise<TOutput>) {
	type Key = DataTag<QueryKey, TOutput, Error>;
	type Options<TData> = Omit<UseQueryOptions<TOutput, Error, TData, Key>, 'queryKey' | 'queryFn'>;
	const keyOf = (input: DeepPartial<TInput> | undefined) =>
		(input === undefined ? [path, { type: 'query' }] : [path, { input, type: 'query' }]) as unknown as Key;

	/** Without `skipToken` the `queryFn` is a function, so the options also suit `useSuspenseQuery`/`fetchQuery`. */
	function queryOptions<TData = TOutput>(
		input: TInput,
		opts?: Options<TData>,
	): UseQueryOptions<TOutput, Error, TData, Key> & { queryKey: Key; queryFn: QueryFunction<TOutput, Key> };
	function queryOptions<TData = TOutput>(
		input: TInput | SkipToken,
		opts?: Options<TData>,
	): UseQueryOptions<TOutput, Error, TData, Key> & { queryKey: Key };
	function queryOptions<TData = TOutput>(
		input: TInput | SkipToken,
		opts?: Options<TData>,
	): UseQueryOptions<TOutput, Error, TData, Key> & { queryKey: Key } {
		const queryFn: QueryFunction<TOutput, Key> | SkipToken =
			input === skipToken ? skipToken : () => fetch(input as TInput);
		return {
			...opts,
			queryKey: keyOf(input === skipToken ? undefined : (input as DeepPartial<TInput>)),
			queryFn,
		};
	}

	return {
		queryKey: (input?: DeepPartial<TInput>) => keyOf(input),
		queryOptions,
		pathFilter: () => ({ queryKey: [path] as QueryKey }),
		/** Imperative call. */
		query: fetch,
	};
}

export function mutation<TInput, TOutput>(path: Path, run: (input: TInput) => Promise<TOutput>) {
	return {
		mutationOptions: <TContext = unknown>(
			opts?: Omit<UseMutationOptions<TOutput, Error, TInput, TContext>, 'mutationFn' | 'mutationKey'>,
		): UseMutationOptions<TOutput, Error, TInput, TContext> => ({
			...opts,
			mutationKey: [path],
			mutationFn: run,
		}),
		mutationKey: () => [path] as QueryKey,
		/** Imperative call. */
		mutate: run,
	};
}

/** No Apollo caching: TanStack Query holds the results (and the streamed updates of a chat). */
export async function runQuery<TData, TVariables extends Record<string, unknown>>(
	document: TypedDocumentNode<TData, TVariables> | DocumentNode,
	variables: TVariables,
): Promise<TData> {
	try {
		const { data } = await apolloClient.query<TData, TVariables>({
			query: document,
			variables,
			fetchPolicy: 'no-cache',
		} as never);
		return data as TData;
	} catch (error) {
		throw toCodedError(error);
	}
}

export async function runMutation<TData, TVariables extends Record<string, unknown>>(
	document: TypedDocumentNode<TData, TVariables>,
	variables: TVariables,
): Promise<TData> {
	try {
		const { data } = await apolloClient.mutate({ mutation: document, variables } as never);
		return data as TData;
	} catch (error) {
		throw toCodedError(error);
	}
}

/** Errors carry the GraphQL code as `data.code` (tRPC's shape), which `lib/api-error.ts` classifies. */
function toCodedError(error: unknown): unknown {
	if (CombinedGraphQLErrors.is(error)) {
		const [first] = error.errors;
		const coded = new Error(first?.message ?? error.message) as Error & { data: { code?: string } };
		coded.data = { code: first?.extensions?.code as string | undefined };
		return coded;
	}
	return error;
}

const DATE_KEY_PATTERN = /(At|^windowStart|^windowEnd)$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/**
 * Upstream's tRPC used superjson, so dates arrived as `Date`; results passed through a `JSON` scalar carry ISO
 * strings. Turns the ISO strings under date-like keys (`createdAt`, `windowStart`…) back into `Date`s, leaving
 * the subtrees under `skipKeys` (e.g. warehouse rows, which upstream also sent as strings) untouched.
 */
export function reviveDates<T>(value: unknown, skipKeys: readonly string[] = []): T {
	if (Array.isArray(value)) {
		return value.map((item) => reviveDates(item, skipKeys)) as T;
	}
	if (value === null || typeof value !== 'object') {
		return value as T;
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			key,
			skipKeys.includes(key)
				? item
				: typeof item === 'string' && DATE_KEY_PATTERN.test(key) && ISO_DATE_PATTERN.test(item)
					? new Date(item)
					: reviveDates(item, skipKeys),
		]),
	) as T;
}
