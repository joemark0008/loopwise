import pg from 'pg';
import { inject } from 'vitest';

/*
 * The e2e database helpers, apart from test-app.ts so a test that builds its own small Nest module doesn't load the
 * whole AppModule.
 */

/** Reference tables loaded once by global-setup (`seedReference`); `resetDatabase` keeps them. */
const REFERENCE_TABLES = ['regions', 'provinces', 'city_municipalities', 'barangays', 'icd10_codes', 'rvs_codes'];

/** Points the app at the e2e database (see global-setup.ts) before any module reads the env. */
export function useTestDatabase(): string {
	const url = inject('testDatabaseUrl');
	process.env.DATABASE_URL = url;
	process.env.MODE = 'test';
	return url;
}

/** Empties the app tables, except the reference data (pg-boss keeps its own schema). */
export async function resetDatabase(url: string): Promise<void> {
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		const { rows } = await client.query<{ tablename: string }>(
			"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' AND NOT (tablename = ANY ($1))",
			[REFERENCE_TABLES],
		);
		await client.query(`TRUNCATE ${rows.map((row) => `"${row.tablename}"`).join(', ')} CASCADE`);
		// Per-story schedules point at rows that no longer exist; app-wide crons are re-registered on boot.
		await client.query(
			"DO $$ BEGIN IF to_regclass('pgboss.schedule') IS NOT NULL THEN DELETE FROM pgboss.schedule WHERE key LIKE 'story-%'; END IF; END $$",
		);
	} finally {
		await client.end();
	}
}
