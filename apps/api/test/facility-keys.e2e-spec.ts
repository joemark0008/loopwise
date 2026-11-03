import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FacilityKeyService } from '../src/facility-keys/facility-key.service.js';
import { hashFacilityKey } from '../src/facility-keys/facility-key-token.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const CREATE = `mutation ($input: CreateFacilityKeyInput!) {
	createFacilityKey(input: $input) { key facilityKey { id name keyPrefix lastUsedAt } }
}`;
const LIST = `query { facilityKeys { id name keyPrefix } }`;
const REVOKE = `mutation ($id: ID!) { revokeFacilityKey(id: $id) }`;

/** Facility keys: issued and revoked by organization admins, stored as hashes, authenticating the ingest. */
describe('facility keys (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let admin: string[];
	let member: string[];

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		const password = 'Sup3r-secret!';
		admin = (await createTestUser(app, { name: 'Admin', email: 'admin@example.com', password })).cookie;
		const created = await createTestUser(app, { name: 'Member', email: 'member@example.com', password });
		member = created.cookie;
		const org = await prisma.organization.findFirstOrThrow();
		await prisma.orgMember.create({ data: { orgId: org.id, userId: created.userId, role: 'user' } });
	});

	afterAll(async () => {
		await app?.close();
	});

	it('shows a new key once, stores only its hash, and authenticates with it until revoked', async () => {
		const created = await graphql(admin, CREATE, { input: { name: 'LIS connector' } });
		expect(created.body.errors).toBeUndefined();
		const { key, facilityKey } = created.body.data.createFacilityKey;
		expect(key).toMatch(/^lw_/);
		expect(facilityKey).toMatchObject({ name: 'LIS connector', keyPrefix: key.slice(0, 10), lastUsedAt: null });

		const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: facilityKey.id } });
		expect(row.keyHash).toBe(hashFacilityKey(key));
		expect(JSON.stringify(row)).not.toContain(key);

		const listed = await graphql(admin, LIST);
		expect(listed.body.data.facilityKeys).toEqual([
			{ id: facilityKey.id, name: 'LIS connector', keyPrefix: key.slice(0, 10) },
		]);
		expect(JSON.stringify(listed.body)).not.toContain(key);

		const keys = app.get(FacilityKeyService);
		await expect(keys.authenticate(key)).resolves.toMatchObject({ id: row.orgId });
		expect((await prisma.apiKey.findUniqueOrThrow({ where: { id: row.id } })).lastUsedAt).not.toBeNull();

		const revoked = await graphql(admin, REVOKE, { id: facilityKey.id });
		expect(revoked.body.data.revokeFacilityKey).toBe(true);
		await expect(keys.authenticate(key)).resolves.toBeNull();
	});

	it('is for organization admins only', async () => {
		const res = await graphql(member, CREATE, { input: { name: 'Sneaky' } });
		expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
		expect((await graphql(member, LIST)).body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
	});
});
