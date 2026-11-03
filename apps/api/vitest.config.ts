import path from 'node:path';

import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// SWC instead of esbuild: Nest's dependency injection needs `emitDecoratorMetadata`.
	plugins: [swc.vite({ module: { type: 'es6' }, jsc: { transform: { react: { runtime: 'automatic' } } } })],
	resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
	test: {
		include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'test/**/*.e2e-spec.ts'],
		globalSetup: ['test/global-setup.ts'],
		fileParallelism: false,
		testTimeout: 20_000,
		hookTimeout: 60_000,
	},
});
