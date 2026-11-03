import type { Type } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import DataLoader from 'dataloader';

import type { LoaderFactory } from './loader-factory.js';

type LoaderOf<F> = F extends LoaderFactory<infer K, infer V> ? DataLoader<K, V | null> : never;

/** The DataLoaders of one GraphQL request, created lazily from the singleton factories. */
export class RequestLoaders {
	private readonly loaders = new Map<Type<unknown>, DataLoader<unknown, unknown>>();

	constructor(private readonly moduleRef: ModuleRef) {}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any factory, typed by LoaderOf<F>
	get<F extends LoaderFactory<any, any>>(factory: Type<F>): LoaderOf<F> {
		let loader = this.loaders.get(factory);
		if (!loader) {
			const instance = this.moduleRef.get(factory, { strict: false });
			loader = new DataLoader((keys: readonly unknown[]) => instance.batch(keys), instance.options);
			this.loaders.set(factory, loader);
		}
		return loader as LoaderOf<F>;
	}
}
