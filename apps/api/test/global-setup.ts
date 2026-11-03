import { execSync } from 'node:child_process';
import path from 'node:path';

import pg from 'pg';
import type { TestProject } from 'vitest/node';

import { loadDotenv } from '../src/config/env.js';

/**
 * e2e tests run against their own database (`<DATABASE_URL database>_test`), created and migrated here,
 * so they never touch the development data.
 */
export default async function setup(project: TestProject) {
	loadDotenv();
	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('DATABASE_URL must be set (see .env.example) to run the tests');
	}
	const url = new URL(baseUrl);
	const testDatabase = `${url.pathname.slice(1)}_test`;
	const testUrl = new URL(baseUrl);
	testUrl.pathname = `/${testDatabase}`;

	const adminUrl = new URL(baseUrl);
	adminUrl.pathname = '/postgres';
	const client = new pg.Client({ connectionString: adminUrl.toString() });
	await client.connect();
	try {
		const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDatabase]);
		if (exists.rowCount === 0) {
			await client.query(`CREATE DATABASE "${testDatabase}"`);
		}
	} finally {
		await client.end();
	}

	execSync('npx prisma migrate deploy', {
		cwd: path.join(import.meta.dirname, '..'),
		env: { ...process.env, DATABASE_URL: testUrl.toString() },
		stdio: 'pipe',
	});

	project.provide('testDatabaseUrl', testUrl.toString());
}

declare module 'vitest' {
	export interface ProvidedContext {
		testDatabaseUrl: string;
	}
}
