import { defineConfig, devices } from '@playwright/test';

/** Needs the local stack from CLAUDE.md: Postgres, `npm run dev:api` and `npm run dev:frontend`. */
export default defineConfig({
	testDir: './e2e',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	reporter: [['list']],
	outputDir: process.env.E2E_OUTPUT_DIR ?? 'test-results',
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
		trace: 'retain-on-failure',
		...devices['Desktop Chrome'],
		viewport: { width: 1440, height: 900 },
	},
});
