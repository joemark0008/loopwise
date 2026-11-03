/**
 * Port of upstream `utils/keyed-lock.ts`, in-memory only: upstream serializes across backend instances with a
 * leased row in its `keyed_lock` table when it runs on Postgres. quarry's only caller is `str_replace`, which edits
 * permanent storage and custom stories (Phase 2d / Phase 4); the database lease comes with them.
 */
const inMemoryLocks = new Map<string, Promise<unknown>>();

export async function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	return withInMemoryLock(key, fn);
}

function withInMemoryLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const previous = inMemoryLocks.get(key) ?? Promise.resolve();
	const current = previous.catch(() => undefined).then(fn);
	inMemoryLocks.set(key, current);
	return current.finally(() => {
		if (inMemoryLocks.get(key) === current) {
			inMemoryLocks.delete(key);
		}
	});
}
