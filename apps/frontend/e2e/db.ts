import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

/**
 * Direct access to the stack's database, for the few tests that need a record the app only writes after a real LLM
 * call (a Wise tool result in a chat). `DATABASE_URL` comes from the environment, else the repository's `.env`, the
 * one the API under test reads. Synthetic data only.
 */
export async function withDatabase<T>(run: (client: pg.Client) => Promise<T>): Promise<T> {
	if (!process.env.DATABASE_URL) {
		const envFile = path.join(import.meta.dirname, '..', '..', '..', '.env');
		if (existsSync(envFile)) {
			process.loadEnvFile(envFile);
		}
	}
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error('Set DATABASE_URL (or the repository .env) to the database of the stack under test');
	}
	const client = new pg.Client({ connectionString });
	await client.connect();
	try {
		return await run(client);
	} finally {
		await client.end();
	}
}
