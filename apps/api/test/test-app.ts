import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { addOrganizationMember, createClinic, createOrganization, createUser } from './fixtures/clinic-fixtures.js';

export { resetDatabase, useTestDatabase } from './test-db.js';

export async function createTestApp(): Promise<NestExpressApplication> {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
	const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
	configureApp(app);
	await app.init();
	return app;
}

/**
 * Creates a user straight through Prisma (sign-up is closed), makes the first one the admin of a default organization
 * (and, when LOOPWISE_DEFAULT_CLINIC_PATH is set, of a default clinic) like the setup wizard does, and signs in through
 * the real endpoint. For richer scenes use `test/fixtures/clinic-fixtures.ts` and `signIn`.
 */
export async function createTestUser(
	app: NestExpressApplication,
	{ name, email, password }: { name: string; email: string; password: string },
): Promise<{ cookie: string[]; userId: string }> {
	const prisma = app.get(PrismaService);
	const userId = await prisma.$transaction(async (tx) => {
		const user = await createUser(tx, { name, email, password });
		if (!(await tx.organization.findFirst())) {
			const organization = await createOrganization(tx, { name: 'Default Organization', slug: 'default' });
			await addOrganizationMember(tx, organization.id, user.id, 'ADMIN');
			const clinicPath = process.env.LOOPWISE_DEFAULT_CLINIC_PATH;
			if (clinicPath) {
				await createClinic(tx, {
					organizationId: organization.id,
					name: clinicPath.split('/').pop() || 'Default Clinic',
					code: 'DEF',
					path: clinicPath,
					staff: [{ userId: user.id, roles: ['ADMIN'] }],
				});
			}
		}
		return user.id;
	});
	return { cookie: await signIn(app, { email, password }), userId };
}

/** Signs in through the real better-auth endpoint and returns the session cookie for `supertest`'s `.set('Cookie', …)`. */
export async function signIn(
	app: NestExpressApplication,
	{ email, password }: { email: string; password: string },
): Promise<string[]> {
	const res = await request(app.getHttpServer())
		.post('/api/auth/sign-in/email')
		.set('Origin', 'http://localhost:3000')
		.send({ email, password })
		.expect(200);
	return [res.headers['set-cookie']].flat().filter(Boolean) as string[];
}
