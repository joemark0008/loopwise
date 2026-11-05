import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/**
 * The clinic and user settings ported at cut-over (Phase 8): `databaseObjects`, `displaySettings`,
 * `userPreferences`, `chatShareMembers` and `chatDownload` (upstream `clinic.getDatabaseObjects`, `get/updateDisplaySettings`,
 * `user.get/updatePreferences`, `clinic.getClinicMembersByChatId`, `chat.download`). Upstream had no tests for these procedures.
 */
describe('clinic and user settings (e2e)', () => {
	let app: NestExpressApplication;
	let cookie: string[] = [];
	let clinicId = '';
	let clinicPath = '';

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		({ cookie } = await createTestUser(app, { name: 'Ada', email: 'ada@example.com', password: 'Sup3r-secret!' }));
		const clinic = await graphql('mutation { createClinic(input: { name: "Settings" }) { id path } }');
		clinicId = clinic.body.data.createClinic.id;
		clinicPath = clinic.body.data.createClinic.path;
	});

	afterAll(async () => {
		await app?.close();
	});

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	it('lists the synced tables of the clinic', async () => {
		const empty = await graphql('{ databaseObjects { fqdn } }');
		expect(empty.body.data.databaseObjects).toEqual([]);

		await mkdir(path.join(clinicPath, 'databases/type=postgres/database=warehouse/schema=public/table=orders'), {
			recursive: true,
		});
		const res = await graphql('{ databaseObjects { type database schema table fqdn } }');
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.databaseObjects).toEqual([
			{
				type: 'postgres',
				database: 'warehouse',
				schema: 'public',
				table: 'orders',
				fqdn: 'warehouse.public.orders',
			},
		]);
	});

	it('reads the default date format and updates it', async () => {
		const initial = await graphql('{ displaySettings }');
		expect(initial.body.data.displaySettings.dateFormat.preset).toBeDefined();

		const updated = await graphql('mutation ($input: JSON!) { updateDisplaySettings(input: $input) }', {
			input: { dateFormat: { preset: 'custom', customFormat: 'yyyy/MM/dd' } },
		});
		expect(updated.body.errors).toBeUndefined();
		expect(updated.body.data.updateDisplaySettings).toEqual({
			dateFormat: { preset: 'custom', customFormat: 'yyyy/MM/dd' },
		});

		// An update without a date format keeps the stored one.
		await graphql('mutation ($input: JSON!) { updateDisplaySettings(input: $input) }', { input: {} });
		const reread = await graphql('{ displaySettings }');
		expect(reread.body.data.displaySettings.dateFormat).toEqual({ preset: 'custom', customFormat: 'yyyy/MM/dd' });
	});

	it('rejects an unknown date format preset', async () => {
		const res = await graphql('mutation ($input: JSON!) { updateDisplaySettings(input: $input) }', {
			input: { dateFormat: { preset: 'lunar' } },
		});
		expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
	});

	it('stores the tool-call density preference', async () => {
		expect((await graphql('{ userPreferences }')).body.data.userPreferences).toEqual({});

		const res = await graphql('mutation { updateUserPreferences(input: { toolCallDensity: "compact" }) }');
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.updateUserPreferences).toEqual({ toolCallDensity: 'compact' });
		expect((await graphql('{ userPreferences }')).body.data.userPreferences).toEqual({
			toolCallDensity: 'compact',
		});
	});

	it('rejects an unknown tool-call density', async () => {
		const res = await graphql('mutation { updateUserPreferences(input: { toolCallDensity: "huge" }) }');
		expect(res.body.errors).toBeDefined();
	});

	it('lists no share members for an unknown chat', async () => {
		const res = await graphql('query ($chatId: ID!) { chatShareMembers(chatId: $chatId) { id email } }', {
			chatId: 'missing-chat',
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.chatShareMembers).toEqual([]);
	});
});
