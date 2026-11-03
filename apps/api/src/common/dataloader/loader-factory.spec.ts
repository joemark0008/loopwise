import type { ModuleRef } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { LoaderFactory, orderByKeys } from './loader-factory.js';
import { RequestLoaders } from './request-loaders.js';

class NumberLoader extends LoaderFactory<number, { id: number }> {
	readonly calls: number[][] = [];

	async batch(keys: readonly number[]) {
		this.calls.push([...keys]);
		return orderByKeys(
			keys,
			keys.filter((key) => key > 0).map((id) => ({ id })),
			(row) => row.id,
		);
	}
}

function loadersFor(factory: NumberLoader) {
	const moduleRef = { get: vi.fn(() => factory) } as unknown as ModuleRef;
	return new RequestLoaders(moduleRef);
}

describe('RequestLoaders', () => {
	it('batches loads made in the same tick into one call', async () => {
		const factory = new NumberLoader();
		const loader = loadersFor(factory).get(NumberLoader);

		const results = await Promise.all([loader.load(1), loader.load(2), loader.load(-1)]);

		expect(results).toEqual([{ id: 1 }, { id: 2 }, null]);
		expect(factory.calls).toEqual([[1, 2, -1]]);
	});

	it('caches per request and starts fresh for the next request', async () => {
		const factory = new NumberLoader();
		const first = loadersFor(factory);
		await first.get(NumberLoader).load(1);
		await first.get(NumberLoader).load(1);
		await loadersFor(factory).get(NumberLoader).load(1);

		expect(factory.calls).toEqual([[1], [1]]);
	});
});
