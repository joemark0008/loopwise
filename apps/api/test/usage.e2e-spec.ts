import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const FILTER = { period: { value: 15, unit: 'day' } };

const ADMIN_CHAT_ID = '0190a0c0-0000-7000-8000-0000000a0001';
const MEMBER_CHAT_ID = '0190a0c0-0000-7000-8000-0000000a0002';

/**
 * Settings → Usage over GraphQL: chat messages and `llm_inference` records combined with their cost, scoped to
 * the caller unless they are a clinic admin, and the saved periods of each user.
 */
describe('usage (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let adminCookie: string[] = [];
	let memberCookie: string[] = [];
	let viewerCookie: string[] = [];
	let clinicId = '';

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);

		const admin = await signUp('Ada', 'ada@example.com');
		adminCookie = admin.cookie;
		const member = await signUp('Bob', 'bob@example.com');
		memberCookie = member.cookie;
		const viewer = await signUp('Vic', 'vic@example.com');
		viewerCookie = viewer.cookie;

		const clinic = await graphql(adminCookie, 'mutation { createClinic(input: { name: "Usage" }) { id } }');
		clinicId = clinic.body.data.createClinic.id;
		await prisma.userClinicRole.createMany({
			data: [
				{ clinicId, userId: member.userId, role: 'MEMBER' },
				{ clinicId, userId: viewer.userId, role: 'VIEWER' },
			],
		});

		await prisma.chat.createMany({
			data: [
				{ id: ADMIN_CHAT_ID, clinicId, userId: admin.userId },
				{ id: MEMBER_CHAT_ID, clinicId, userId: member.userId },
			],
		});
		await prisma.chatMessage.createMany({
			data: [
				{ chatId: ADMIN_CHAT_ID, role: 'user', source: 'web' },
				{
					chatId: ADMIN_CHAT_ID,
					role: 'assistant',
					llmProvider: 'anthropic',
					llmModelId: 'claude-haiku-4-5',
					inputNoCacheTokens: 1_000_000,
					outputTotalTokens: 1_000_000,
					totalTokens: 2_000_000,
				},
				{ chatId: MEMBER_CHAT_ID, role: 'user', source: 'web' },
			],
		});
		await prisma.llmInference.create({
			data: {
				clinicId,
				userId: member.userId,
				chatId: MEMBER_CHAT_ID,
				type: 'title_generation',
				llmProvider: 'anthropic',
				llmModelId: 'claude-haiku-4-5',
				inputNoCacheTokens: 1_000_000,
				totalTokens: 1_000_000,
			},
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	const signUp = (name: string, email: string) => createTestUser(app, { name, email, password: 'Sup3r-secret!' });

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	const usage = (cookie: string[]) =>
		graphql(
			cookie,
			`
				query ($filter: UsageFilterInput!) {
					usageMessages(filter: $filter) {
						date
						messageCount
						totalTokens
						totalCost
					}
					usageByUser(filter: $filter) {
						date
						users {
							userName
							messageCount
							totalCost
						}
					}
					usageTotal(filter: $filter) {
						totalMessages
						uniqueUsers
					}
					usageProviders
				}
			`,
			{ filter: FILTER },
		);

	it('shows clinic admins the whole clinic, with the cost of messages and other model calls', async () => {
		const res = await usage(adminCookie);

		expect(res.body.errors).toBeUndefined();
		const { usageMessages, usageByUser, usageTotal, usageProviders } = res.body.data;
		expect(usageMessages).toHaveLength(15);
		const totals = usageMessages.reduce(
			(sum: { tokens: number; cost: number }, record: { totalTokens: number; totalCost: number }) => ({
				tokens: sum.tokens + record.totalTokens,
				cost: sum.cost + record.totalCost,
			}),
			{ tokens: 0, cost: 0 },
		);
		expect(totals.tokens).toBe(3_000_000);
		expect(totals.cost).toBeCloseTo(7);
		expect(usageTotal).toEqual({ totalMessages: 2, uniqueUsers: 2 });
		expect(usageProviders).toEqual(['anthropic']);
		const users = usageByUser.flatMap((record: { users: Array<{ userName: string }> }) => record.users);
		expect(users.map((user: { userName: string }) => user.userName).sort()).toEqual(['Ada', 'Bob']);
	});

	it('shows other members only their own usage', async () => {
		const res = await usage(memberCookie);

		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.usageTotal).toEqual({ totalMessages: 1, uniqueUsers: 1 });
		const cost = res.body.data.usageMessages.reduce(
			(sum: number, record: { totalCost: number }) => sum + record.totalCost,
			0,
		);
		expect(cost).toBeCloseTo(1);
	});

	it('lists the users of the clinic for the admin filters only', async () => {
		const query = 'query { usageUserFacets { userName chatCount } }';

		expect((await graphql(adminCookie, query)).body.data.usageUserFacets).toEqual([
			{ userName: 'Ada', chatCount: 1 },
			{ userName: 'Bob', chatCount: 1 },
		]);
		expect((await graphql(memberCookie, query)).body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
	});

	it('refuses viewers', async () => {
		const res = await usage(viewerCookie);

		expect(res.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
	});

	it('rejects a range above the chart bucket limit', async () => {
		const res = await graphql(
			adminCookie,
			'query ($filter: UsageFilterInput!) { usageMessages(filter: $filter) { date } }',
			{ filter: { period: { value: 84, unit: 'day' }, granularity: 'hour' } },
		);

		expect(res.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
	});

	it('saves, selects and deletes a usage period per user', async () => {
		const created = await graphql(
			memberCookie,
			`
				mutation ($clinicId: ID!) {
					createSavedUsagePeriod(clinicId: $clinicId, savedPeriod: { days: 365, granularity: "month" }) {
						id
						days
						granularity
					}
				}
			`,
			{ clinicId },
		);
		expect(created.body.errors).toBeUndefined();
		const savedPeriod = created.body.data.createSavedUsagePeriod;

		const settings = (cookie: string[]) =>
			graphql(
				cookie,
				`
					query ($clinicId: ID!) {
						usagePeriodSettings(clinicId: $clinicId) {
							selection {
								mode
								savedPeriodId
							}
							savedPeriods {
								id
								days
								granularity
							}
						}
					}
				`,
				{ clinicId },
			);
		expect((await settings(memberCookie)).body.data.usagePeriodSettings).toEqual({
			selection: { mode: 'saved', savedPeriodId: savedPeriod.id },
			savedPeriods: [savedPeriod],
		});
		expect((await settings(adminCookie)).body.data.usagePeriodSettings).toEqual({
			selection: null,
			savedPeriods: [],
		});

		const deleted = await graphql(
			memberCookie,
			`
				mutation ($clinicId: ID!, $id: ID!) {
					deleteSavedUsagePeriod(clinicId: $clinicId, id: $id) {
						id
						selection {
							mode
						}
					}
				}
			`,
			{ clinicId, id: savedPeriod.id },
		);
		expect(deleted.body.data.deleteSavedUsagePeriod).toEqual({ id: savedPeriod.id, selection: { mode: '15d' } });
	});
});
