/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

/** apps/api (NestJS + GraphQL), which serves every request the frontend makes. */
const LOOPWISE_API_URL = process.env.LOOPWISE_API_URL ?? 'http://localhost:5006';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		devtools({
			enhancedLogs: {
				enabled: false,
			},
			// Overridable so two dev servers can run side by side.
			eventBusConfig: { port: Number(process.env.TANSTACK_DEVTOOLS_PORT ?? 42069) },
		}),
		tanstackRouter({
			target: 'react',
			autoCodeSplitting: false,
		}),
		viteReact({ exclude: [/\/node_modules\//] }),
		tailwindcss(),
		svgr({
			include: '**/*.svg',
			svgrOptions: { exportType: 'default' },
		}),
	],
	resolve: {
		alias: [
			{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
			// Pure modules of apps/api the frontend shares (provider metadata, story summaries); the rest is types.
			{ find: /^@loopwise\/api\/(.*)$/, replacement: fileURLToPath(new URL('../api/src/$1', import.meta.url)) },
		],
	},
	test: {
		// e2e/ runs under Playwright (`npm run test:e2e`).
		exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
		setupFiles: ['./src/test/setup.ts'],
	},
	server: {
		fs: {
			// apps/shared and the apps/api modules above live outside this package.
			allow: ['../..'],
		},
		// In production apps/api serves the built frontend from the same origin.
		proxy: {
			'/graphql': { target: LOOPWISE_API_URL },
			'/api': { target: LOOPWISE_API_URL },
			'/health': { target: LOOPWISE_API_URL },
			'/i/': { target: LOOPWISE_API_URL },
			'/c/': { target: LOOPWISE_API_URL },
		},
	},
});
