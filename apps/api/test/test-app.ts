import 'reflect-metadata';

import crypto from 'node:crypto';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';
import request from 'supertest';
import { inject } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { OrganizationRepository } from '../src/organizations/organization.repository.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRepository } from '../src/users/user.repository.js';

/** Points the app at the e2e database (see global-setup.ts) before any module reads the env. */
export function useTestDatabase(): string {
	const url = inject('testDatabaseUrl');
	process.env.DATABASE_URL = url;
	process.env.MODE = 'test';
	return url;
}

/** Empties the app tables (pg-boss keeps its own schema). */
export async function resetDatabase(url: string): Promise<void> {
	const client = new pg.Client({ connectionString: url });
	await client.connect();
	try {
		const { rows } = await client.query<{ tablename: string }>(
			"SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
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

export async function createTestApp(): Promise<NestExpressApplication> {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
	const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
	configureApp(app);
	await app.init();
	return app;
}

/**
 * Creates a user straight through the repository (sign-up is closed), makes the first one the
 * organization admin like the setup wizard does, and signs in through the real endpoint.
 */
export async function createTestUser(
	app: NestExpressApplication,
	{ name, email, password }: { name: string; email: string; password: string },
): Promise<{ cookie: string[]; userId: string }> {
	const users = app.get(UserRepository);
	const organizations = app.get(OrganizationRepository);
	const userId = crypto.randomUUID();
	const hashedPassword = await hashPassword(password);
	await app.get(PrismaService).$transaction(async (tx) => {
		await users.createUser(
			{ id: userId, name, email, emailVerified: true },
			{ id: crypto.randomUUID(), accountId: userId, providerId: 'credential', password: hashedPassword },
			tx,
		);
		await organizations.initializeDefaultOrganization(userId, tx);
	});
	const res = await request(app.getHttpServer())
		.post('/api/auth/sign-in/email')
		.set('Origin', 'http://localhost:3000')
		.send({ email, password })
		.expect(200);
	return { cookie: [res.headers['set-cookie']].flat().filter(Boolean) as string[], userId };
}
