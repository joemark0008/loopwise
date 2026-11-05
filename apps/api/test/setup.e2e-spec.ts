import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { deriveSetupToken } from '../src/setup/setup-token.js';
import { createTestApp, resetDatabase, useTestDatabase } from './test-app.js';

const ORIGIN = 'http://localhost:3000';
const COMPLETE = `mutation Complete($input: CompleteSetupInput!) { completeSetup(input: $input) }`;

describe('setup (e2e)', () => {
	let app: NestExpressApplication;
	let databaseUrl: string;
	const token = () => deriveSetupToken(process.env.BETTER_AUTH_SECRET!);

	beforeAll(async () => {
		databaseUrl = useTestDatabase();
		app = await createTestApp();
	});

	beforeEach(async () => {
		await resetDatabase(databaseUrl);
	});

	afterAll(async () => {
		await app?.close();
	});

	const complete = (input: Record<string, unknown>) =>
		request(app.getHttpServer()).post('/graphql').send({ query: COMPLETE, variables: { input } });

	const valid = (overrides: Record<string, unknown> = {}) => ({
		token: token(),
		name: 'Admin',
		email: 'admin@example.com',
		password: 'Sup3r-secret!',
		...overrides,
	});

	const signIn = (email: string, password = 'Sup3r-secret!') =>
		request(app.getHttpServer()).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password });

	const query = async <T>(sql: string): Promise<T[]> => {
		const client = new pg.Client({ connectionString: databaseUrl });
		await client.connect();
		try {
			return (await client.query(sql)).rows;
		} finally {
			await client.end();
		}
	};
	const countUsers = async () => Number((await query<{ n: string }>('SELECT count(*) AS n FROM users'))[0].n);

	it('refuses a wrong token and creates nothing', async () => {
		const res = await complete(valid({ token: '0'.repeat(32) }));
		expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
		expect(res.body.errors[0].message).toBe('Invalid setup token.');
		const has = await request(app.getHttpServer()).post('/graphql').send({ query: '{ hasUsers }' });
		expect(has.body.data.hasUsers).toBe(false);
	});

	it('creates the admin, who can sign in', async () => {
		const res = await complete(valid());
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.completeSetup).toBe(true);

		const rows = await query(
			`SELECT o.slug, m.role FROM organization_members m JOIN organizations o ON o.id = m.organization_id
			 JOIN users u ON u.id = m.user_id WHERE u.email = 'admin@example.com'`,
		);
		expect(rows).toEqual([{ slug: 'default', role: 'ADMIN' }]);
		await signIn('admin@example.com').expect(200);
	});

	it('stores the email trimmed and lower-cased', async () => {
		const res = await complete(valid({ email: 'Admin@Example.com ' }));
		expect(res.body.errors).toBeUndefined();
		expect((await query<{ email: string }>('SELECT email FROM users')).map((r) => r.email)).toEqual([
			'admin@example.com',
		]);
		await signIn('ADMIN@example.com').expect(200);
	});

	it('refuses an email that better-auth could not sign in, and creates nothing', async () => {
		const res = await complete(valid({ email: 'é@x.com' }));
		expect(res.body.errors).toBeDefined();
		expect(await countUsers()).toBe(0);
	});

	it('refuses a second setup', async () => {
		await complete(valid());
		const res = await complete(valid({ email: 'other@example.com' }));
		expect(res.body.errors[0].extensions.code).toBe('CONFLICT');
		expect(res.body.errors[0].message).toBe('Setup is already complete.');
		expect(await countUsers()).toBe(1);
	});

	it('creates exactly one user from concurrent calls', async () => {
		const results = await Promise.all(
			[1, 2, 3, 4, 5].map((i) => complete(valid({ email: `admin${i}@example.com` }))),
		);
		const ok = results.filter((r) => !r.body.errors);
		const conflicts = results.filter((r) => r.body.errors?.[0]?.extensions?.code === 'CONFLICT');
		expect(ok).toHaveLength(1);
		expect(conflicts).toHaveLength(4);
		expect(await countUsers()).toBe(1);
	});

	it('refuses a short, an over-long and a blank-name input', async () => {
		for (const bad of [{ password: 'a'.repeat(7) }, { password: 'a'.repeat(129) }, { name: '   ' }]) {
			const res = await complete(valid(bad));
			expect(res.body.errors).toBeDefined();
			expect(await countUsers()).toBe(0);
		}
		const res = await complete(valid({ password: 'a'.repeat(128) }));
		expect(res.body.errors).toBeUndefined();
		await signIn('admin@example.com', 'a'.repeat(128)).expect(200);
	});

	const signUp = (email: string) =>
		request(app.getHttpServer())
			.post('/api/auth/sign-up/email')
			.set('Origin', ORIGIN)
			.send({ name: 'Intruder', email, password: 'Sup3r-secret!' });

	it('refuses email sign-up before and after setup', async () => {
		expect((await signUp('a@example.com')).status).not.toBe(200);
		expect(await countUsers()).toBe(0);
		await complete(valid());
		expect((await signUp('b@example.com')).status).not.toBe(200);
		expect(await countUsers()).toBe(1);
	});

	it('refuses user creation through better-auth, which covers first-time social sign-in', async () => {
		const ctx = await (await app.get(AuthService).getAuth()).$context;
		await expect(
			ctx.internalAdapter.createUser({ name: 'Social', email: 'social@example.com', emailVerified: false }),
		).rejects.toThrow('signup_disabled');
		expect(await countUsers()).toBe(0);
	});

	it('still signs in an existing user', async () => {
		await complete(valid());
		await signIn('admin@example.com').expect(200);
	});
});
