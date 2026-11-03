import type { NestExpressApplication } from '@nestjs/platform-express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const ORIGIN = 'http://localhost:3000';
const ME = '{ me { id name email emailVerified isActive } }';

describe('auth (e2e)', () => {
	let app: NestExpressApplication;
	let cookie: string[] = [];
	let databaseUrl: string;

	beforeAll(async () => {
		databaseUrl = useTestDatabase();
		await resetDatabase(databaseUrl);
		app = await createTestApp();
	});

	afterAll(async () => {
		await app?.close();
	});

	const graphql = (query: string, cookies: string[] = []) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookies).send({ query });

	it('reports the database as healthy', async () => {
		const res = await request(app.getHttpServer()).get('/health').expect(200);
		expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
	});

	it('reports no users yet', async () => {
		const res = await graphql('{ hasUsers publicConfig { quarryMode enableUserLogin } }');
		expect(res.body.data).toEqual({
			hasUsers: false,
			publicConfig: { quarryMode: 'self-hosted', enableUserLogin: true },
		});
	});

	it('rejects `me` without a session', async () => {
		const res = await graphql(ME);
		expect(res.body.errors[0].extensions.code).toBe('UNAUTHORIZED');
	});

	it('creates the first user and sets a session cookie', async () => {
		({ cookie } = await createTestUser(app, { name: 'Ada', email: 'ada@example.com', password: 'Sup3r-secret!' }));
		expect(cookie.some((c) => c.startsWith('better-auth.session_token='))).toBe(true);
	});

	it('returns the current user from the session cookie', async () => {
		const res = await graphql(ME, cookie);
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.me).toMatchObject({ name: 'Ada', email: 'ada@example.com', isActive: true });
	});

	it('makes the first user admin of the default organization', async () => {
		const client = new pg.Client({ connectionString: databaseUrl });
		await client.connect();
		try {
			const { rows } = await client.query(
				`SELECT o.slug, m.role FROM org_member m
				 JOIN organization o ON o.id = m.org_id
				 JOIN "user" u ON u.id = m.user_id
				 WHERE u.email = 'ada@example.com'`,
			);
			expect(rows).toEqual([{ slug: 'default', role: 'admin' }]);
		} finally {
			await client.end();
		}

		const res = await graphql('{ hasUsers }', cookie);
		expect(res.body.data).toEqual({ hasUsers: true });
	});

	it('updates the profile', async () => {
		const res = await graphql('mutation { updateProfile(input: { name: "Ada L." }) { name } }', cookie);
		expect(res.body.data.updateProfile).toEqual({ name: 'Ada L.' });
	});

	it('logs in again with email and password', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/auth/sign-in/email')
			.set('Origin', ORIGIN)
			.send({ email: 'ada@example.com', password: 'Sup3r-secret!' })
			.expect(200);
		expect(res.body.user.email).toBe('ada@example.com');
	});

	it('logs out and invalidates the session', async () => {
		await request(app.getHttpServer())
			.post('/api/auth/sign-out')
			.set('Origin', ORIGIN)
			.set('Cookie', cookie)
			.send({})
			.expect(200);

		const res = await graphql(ME, cookie);
		expect(res.body.errors[0].extensions.code).toBe('UNAUTHORIZED');
	});

	it('redirects auth errors to the login page', async () => {
		const res = await request(app.getHttpServer()).get('/api/auth/error?error=access_denied').expect(302);
		expect(res.headers.location).toBe('/login?error=access_denied');
	});
});
