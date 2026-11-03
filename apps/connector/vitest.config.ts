import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		// node:sqlite is still flagged experimental in Node 22; the warning is noise in test output.
		execArgv: ['--disable-warning=ExperimentalWarning'],
		testTimeout: 15_000,
	},
});
