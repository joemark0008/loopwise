import type DataLoader from 'dataloader';

/**
 * Base class for a feature's DataLoader (`<feature>.loader.ts`). Subclasses are plain singleton
 * providers; `RequestLoaders` builds one `DataLoader` per factory per GraphQL request, so batching
 * and caching never leak between requests.
 */
export abstract class LoaderFactory<K, V> {
	/** Loads values for `keys`, in the same order (`null` for a missing key). */
	abstract batch(keys: readonly K[]): Promise<Array<V | null | Error>>;

	readonly options?: DataLoader.Options<K, V | null>;
}

/** Orders `rows` by `keys` for a batch function: one entry per key, `null` when a key has no row. */
export function orderByKeys<K, V>(keys: readonly K[], rows: readonly V[], keyOf: (row: V) => K): Array<V | null> {
	const byKey = new Map(rows.map((row) => [keyOf(row), row]));
	return keys.map((key) => byKey.get(key) ?? null);
}
