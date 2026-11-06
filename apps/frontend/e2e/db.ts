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

/**
 * Runs `run` in a transaction as the user with `email`, as `ClinicalDbService.asUser` does: `app.user_id` set and the
 * role switched to `loopwise_app`, so row-level security shows only the rows that user may see. Rolled back at the end.
 */
export async function asUser<T>(email: string, run: (client: pg.Client) => Promise<T>): Promise<T> {
	return withDatabase(async (client) => {
		const { rows } = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
		if (rows.length === 0) {
			throw new Error(`No user ${email} in the database under test`);
		}
		await client.query('BEGIN');
		try {
			await client.query("SELECT set_config('app.user_id', $1, true)", [rows[0].id]);
			await client.query('SET LOCAL ROLE loopwise_app');
			return await run(client);
		} finally {
			await client.query('ROLLBACK');
		}
	});
}
