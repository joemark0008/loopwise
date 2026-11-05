import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';

import type { ConfigService } from '../config/config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRepository } from '../users/user.repository.js';
import { UsageRepository } from './usage.repository.js';
import type { UsagePeriodRange, UserClinicPreferences } from './usage.types.js';
import { usagePeriodRangeSchema } from './usage.types.js';
import { buildModelCostRows } from './usage-costs.js';
import { formatDate } from './usage-date.js';

/** Port of upstream `usage-queries.test.ts` (SQLite there, the e2e Postgres database here). */
let prisma: PrismaService;
let usage: UsageRepository;
let users: UserRepository;

// Upstream mocks the clinic's LLM configs away: catalogue prices only.
const COSTS = buildModelCostRows([]);

const getMessagesUsage = (
	clinicId: string,
	filter: Parameters<UsageRepository['getMessagesUsage']>[1],
	userId?: string,
) => usage.getMessagesUsage(clinicId, filter, COSTS, userId);
const getMessagesUsageByUser = (
	clinicId: string,
	filter: Parameters<UsageRepository['getMessagesUsageByUser']>[1],
	userId?: string,
) => usage.getMessagesUsageByUser(clinicId, filter, COSTS, userId);
const getTotalUsage = (...args: Parameters<UsageRepository['getTotalUsage']>) => usage.getTotalUsage(...args);
const getUsedProviders = (...args: Parameters<UsageRepository['getUsedProviders']>) => usage.getUsedProviders(...args);
const getUserPreferences = (userId: string) => users.getUserPreferences(userId);
const updateUserPreferences = (...args: Parameters<UserRepository['updateUserPreferences']>) =>
	users.updateUserPreferences(...args);
const mutateUserPreferences = (...args: Parameters<UserRepository['mutateUserPreferences']>) =>
	users.mutateUserPreferences(...args);

const CLINIC_ID = 'usage-clinic';
const OTHER_CLINIC_ID = 'usage-clinic-other';
const USER_ID = 'usage-user';
const OTHER_USER_ID = 'usage-user-other';
const CHAT_ID = 'usage-chat';
const OTHER_USER_CHAT_ID = 'usage-chat-other-user';

describe('usage query results', () => {
	beforeAll(async () => {
		const config = { env: { DATABASE_URL: inject('testDatabaseUrl'), DB_SSL: false, DB_QUERY_LOGGING: false } };
		prisma = new PrismaService(config as unknown as ConfigService);
		await prisma.$connect();
		usage = new UsageRepository(prisma);
		users = new UserRepository(prisma);
		await cleanup();
		await prisma.user.createMany({
			data: [
				{ id: USER_ID, name: 'Usage User', email: 'usage@example.com' },
				{ id: OTHER_USER_ID, name: 'Other Usage User', email: 'other-usage@example.com' },
			],
		});
		await prisma.clinic.createMany({
			data: [
				{ id: CLINIC_ID, name: 'Usage Clinic', type: 'local', path: '/tmp/usage-clinic' },
				{ id: OTHER_CLINIC_ID, name: 'Other Usage Clinic', type: 'local', path: '/tmp/usage-clinic-other' },
			],
		});
		await prisma.chat.createMany({
			data: [
				{ id: CHAT_ID, clinicId: CLINIC_ID, userId: USER_ID },
				{ id: OTHER_USER_CHAT_ID, clinicId: CLINIC_ID, userId: OTHER_USER_ID },
			],
		});
	});

	beforeEach(async () => {
		await prisma.userPreference.deleteMany({ where: { userId: { in: [USER_ID, OTHER_USER_ID] } } });
		await prisma.llmInference.deleteMany({ where: { clinicId: CLINIC_ID } });
		await prisma.chatMessage.deleteMany({ where: { chatId: { in: [CHAT_ID, OTHER_USER_CHAT_ID] } } });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	afterAll(async () => {
		await cleanup();
		await prisma.$disconnect();
	});

	it('returns total usage aggregates as numbers', async () => {
		await prisma.chatMessage.createMany({
			data: [
				{ id: 'total-1', chatId: CHAT_ID, role: 'user' },
				{ id: 'total-2', chatId: CHAT_ID, role: 'user' },
			],
		});

		await expect(getTotalUsage(CLINIC_ID, { period: { value: 15, unit: 'day' } })).resolves.toEqual({
			totalMessages: 2,
			uniqueUsers: 1,
		});
	});

	it.each([
		[{ value: 24, unit: 'hour' }, 24],
		[{ value: 15, unit: 'day' }, 15],
		[{ value: 30, unit: 'day' }, 30],
		[{ value: 6, unit: 'month' }, 6],
	] satisfies [UsagePeriodRange, number][])(
		'returns one data point per period within the natural granularity cap',
		async (period, expectedLength) => {
			await expect(getMessagesUsage(CLINIC_ID, { period })).resolves.toHaveLength(expectedLength);
		},
	);

	it('uses the same calendar boundary for totals and chart data', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-03T10:00:00Z'));
		const period = { value: 15, unit: 'day' as const };

		await prisma.chatMessage.createMany({
			data: [
				{
					id: 'outside-calendar-range',
					chatId: CHAT_ID,
					role: 'user',
					createdAt: new Date('2026-08-19T12:00:00Z'),
				},
				{
					id: 'inside-calendar-range',
					chatId: CHAT_ID,
					role: 'user',
					createdAt: new Date('2026-08-20T12:00:00Z'),
				},
			],
		});

		const [records, total] = await Promise.all([
			getMessagesUsage(CLINIC_ID, { period }),
			getTotalUsage(CLINIC_ID, { period }),
		]);

		expect(records[0]?.date).toBe('2026-08-20');
		expect(records.reduce((sum, record) => sum + record.messageCount, 0)).toBe(1);
		expect(total.totalMessages).toBe(1);
	});

	it('stores period preferences independently for each user and clinic', async () => {
		const usagePeriod = { mode: '6m' as const };
		const savedUsagePeriods = [{ id: 'year', days: 365, granularity: 'month' as const }];
		const clinicPreferences = { usagePeriod, savedUsagePeriods };

		await updateUserPreferences(USER_ID, {
			projectPreferences: {
				[CLINIC_ID]: clinicPreferences,
			},
		});

		await expect(getUserPreferences(USER_ID)).resolves.toEqual({
			projectPreferences: {
				[CLINIC_ID]: clinicPreferences,
			},
		});
		await expect(getUserPreferences(OTHER_USER_ID)).resolves.toEqual({});
		expect((await getUserPreferences(USER_ID)).projectPreferences?.[OTHER_CLINIC_ID]).toBeUndefined();
	});

	it('serializes concurrent clinic preference transforms', async () => {
		await updateUserPreferences(USER_ID, { toolCallDensity: 'detailed' });
		await Promise.all([
			mutateUserPreferences(USER_ID, (current) => {
				const clinicPreferences = (current.projectPreferences?.[CLINIC_ID] ?? {}) as UserClinicPreferences;
				return {
					...current,
					projectPreferences: {
						...current.projectPreferences,
						[CLINIC_ID]: {
							...clinicPreferences,
							savedUsagePeriods: [
								...(clinicPreferences.savedUsagePeriods ?? []),
								{ id: 'first', days: 30, granularity: 'day' },
							],
						},
					},
				};
			}),
			mutateUserPreferences(USER_ID, (current) => {
				const clinicPreferences = (current.projectPreferences?.[CLINIC_ID] ?? {}) as UserClinicPreferences;
				return {
					...current,
					projectPreferences: {
						...current.projectPreferences,
						[CLINIC_ID]: {
							...clinicPreferences,
							savedUsagePeriods: [
								...(clinicPreferences.savedUsagePeriods ?? []),
								{ id: 'second', days: 365, granularity: 'month' },
							],
						},
					},
				};
			}),
		]);

		const preferences = await getUserPreferences(USER_ID);
		const clinicPreferences = preferences.projectPreferences?.[CLINIC_ID] as UserClinicPreferences | undefined;
		expect(preferences.toolCallDensity).toBe('detailed');
		expect(clinicPreferences?.savedUsagePeriods).toHaveLength(2);
		expect(clinicPreferences?.savedUsagePeriods).toEqual(
			expect.arrayContaining([
				{ id: 'first', days: 30, granularity: 'day' },
				{ id: 'second', days: 365, granularity: 'month' },
			]),
		);
	});

	it('accepts positive period values without a maximum', () => {
		expect(usagePeriodRangeSchema.safeParse({ value: 24, unit: 'hour' }).success).toBe(true);
		expect(usagePeriodRangeSchema.safeParse({ value: 5000, unit: 'day' }).success).toBe(true);
		expect(usagePeriodRangeSchema.safeParse({ value: 1000, unit: 'month' }).success).toBe(true);
		expect(usagePeriodRangeSchema.safeParse({ value: 0, unit: 'day' }).success).toBe(false);
		expect(usagePeriodRangeSchema.safeParse({ value: 1.5, unit: 'day' }).success).toBe(false);
	});

	it('uses an explicit chart granularity', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-03T10:00:00Z'));

		await expect(
			getMessagesUsage(CLINIC_ID, {
				period: { value: 365, unit: 'day' },
				granularity: 'month',
			}),
		).resolves.toHaveLength(13);
	});

	it('counts messages by source, including context recommendations', async () => {
		const sources = [
			'web',
			'slack',
			'teams',
			'telegram',
			'mattermost',
			'discord',
			'whatsapp',
			'admin',
			'mcp',
			'contextRecommendations',
		] as const;
		const now = new Date();
		await prisma.chatMessage.createMany({
			data: sources.map((source, index) => ({
				id: `source-${index}`,
				chatId: CHAT_ID,
				role: 'user' as const,
				source,
				createdAt: now,
			})),
		});

		const records = await getMessagesUsage(CLINIC_ID, { period: { value: 15, unit: 'day' } });
		const record = records.find((item) => item.date === formatDate(now, 'day'));

		expect(record).toMatchObject({
			messageCount: 10,
			webMessageCount: 1,
			slackMessageCount: 1,
			teamsMessageCount: 1,
			telegramMessageCount: 1,
			mattermostMessageCount: 1,
			discordMessageCount: 1,
			whatsappMessageCount: 1,
			adminMessageCount: 1,
			mcpMessageCount: 1,
			contextRecommendationsMessageCount: 1,
		});
	});

	it('unions auxiliary inference usage with message usage across dates', async () => {
		const now = new Date();
		const previousDay = new Date(now);
		previousDay.setUTCDate(previousDay.getUTCDate() - 1);

		await prisma.chatMessage.createMany({
			data: [
				{
					id: 'union-user',
					chatId: CHAT_ID,
					role: 'user',
					source: 'web',
					createdAt: new Date(now.getTime() - 1_000),
				},
				{
					id: 'union-assistant',
					chatId: CHAT_ID,
					role: 'assistant',
					llmProvider: 'openai',
					llmModelId: 'gpt-4o',
					inputNoCacheTokens: 100,
					inputCacheReadTokens: 10,
					outputTotalTokens: 50,
					totalTokens: 160,
					createdAt: now,
				},
			],
		});
		await prisma.llmInference.createMany({
			data: [
				{
					id: 'union-inference-current',
					clinicId: CLINIC_ID,
					userId: USER_ID,
					chatId: CHAT_ID,
					type: 'title_generation',
					llmProvider: 'openai',
					llmModelId: 'gpt-4o',
					inputNoCacheTokens: 30,
					inputCacheReadTokens: 10,
					outputTotalTokens: 10,
					totalTokens: 50,
					createdAt: now,
				},
				{
					id: 'union-inference-previous',
					clinicId: CLINIC_ID,
					userId: USER_ID,
					type: 'compaction',
					llmProvider: 'openai',
					llmModelId: 'gpt-4o',
					inputNoCacheTokens: 40,
					outputTotalTokens: 5,
					totalTokens: 45,
					createdAt: previousDay,
				},
			],
		});

		const records = await getMessagesUsage(CLINIC_ID, { period: { value: 15, unit: 'day' } });

		expect(records.find((item) => item.date === formatDate(now, 'day'))).toMatchObject({
			messageCount: 1,
			webMessageCount: 1,
			inputNoCacheTokens: 130,
			inputCacheReadTokens: 20,
			outputTotalTokens: 60,
			totalTokens: 210,
		});
		expect(records.find((item) => item.date === formatDate(previousDay, 'day'))).toMatchObject({
			messageCount: 0,
			inputNoCacheTokens: 40,
			outputTotalTokens: 5,
			totalTokens: 45,
		});
	});

	it('breaks down messages, tokens and cost per user for every date', async () => {
		const now = new Date();
		const previousDay = new Date(now);
		previousDay.setUTCDate(previousDay.getUTCDate() - 1);

		await prisma.chatMessage.createMany({
			data: [
				{ id: 'by-user-1', chatId: CHAT_ID, role: 'user', source: 'web', createdAt: now },
				{ id: 'by-user-2', chatId: CHAT_ID, role: 'user', source: 'slack', createdAt: now },
				{
					id: 'by-user-assistant',
					chatId: CHAT_ID,
					role: 'assistant',
					llmProvider: 'anthropic',
					llmModelId: 'claude-haiku-4-5',
					inputNoCacheTokens: 1_000_000,
					outputTotalTokens: 1_000_000,
					totalTokens: 2_000_000,
					createdAt: now,
				},
				{ id: 'by-other-user-1', chatId: OTHER_USER_CHAT_ID, role: 'user', source: 'web', createdAt: now },
				{ id: 'by-other-user-previous', chatId: OTHER_USER_CHAT_ID, role: 'user', createdAt: previousDay },
			],
		});
		await prisma.llmInference.createMany({
			data: {
				id: 'by-other-user-inference',
				clinicId: CLINIC_ID,
				userId: OTHER_USER_ID,
				chatId: OTHER_USER_CHAT_ID,
				type: 'title_generation',
				llmProvider: 'openai',
				llmModelId: 'gpt-4o',
				inputNoCacheTokens: 30,
				totalTokens: 30,
				createdAt: now,
			},
		});

		const records = await getMessagesUsageByUser(CLINIC_ID, { period: { value: 15, unit: 'day' } });

		expect(records).toHaveLength(15);
		expect(records.every((record) => Array.isArray(record.users))).toBe(true);

		const today = records.find((record) => record.date === formatDate(now, 'day'));
		const usageUser = today?.users.find((user) => user.userName === 'Usage User');
		const otherUser = today?.users.find((user) => user.userName === 'Other Usage User');
		expect(today?.users).toHaveLength(2);
		expect(usageUser).toMatchObject({ messageCount: 2, totalTokens: 2_000_000 });
		expect(usageUser?.totalCost).toBeCloseTo(6);
		expect(otherUser).toMatchObject({ messageCount: 1, totalTokens: 30 });

		expect(records.find((record) => record.date === formatDate(previousDay, 'day'))?.users).toEqual([
			{ userName: 'Other Usage User', messageCount: 1, totalTokens: 0, totalCost: 0 },
		]);
	});

	it('scopes every usage aggregate and provider to one user', async () => {
		const now = new Date();
		await prisma.chatMessage.createMany({
			data: [
				{ id: 'own-message', chatId: CHAT_ID, role: 'user', source: 'web', createdAt: now },
				{
					id: 'own-assistant',
					chatId: CHAT_ID,
					role: 'assistant',
					llmProvider: 'anthropic',
					llmModelId: 'claude-haiku-4-5',
					totalTokens: 100,
					createdAt: now,
				},
				{ id: 'other-message', chatId: OTHER_USER_CHAT_ID, role: 'user', source: 'web', createdAt: now },
			],
		});
		await prisma.llmInference.createMany({
			data: {
				id: 'other-inference',
				clinicId: CLINIC_ID,
				userId: OTHER_USER_ID,
				chatId: OTHER_USER_CHAT_ID,
				type: 'title_generation',
				llmProvider: 'openai',
				llmModelId: 'gpt-4o',
				totalTokens: 50,
				createdAt: now,
			},
		});
		const period = { value: 15, unit: 'day' as const };

		const [usage, byUser, total, providers] = await Promise.all([
			getMessagesUsage(CLINIC_ID, { period }, USER_ID),
			getMessagesUsageByUser(CLINIC_ID, { period }, USER_ID),
			getTotalUsage(CLINIC_ID, { period }, USER_ID),
			getUsedProviders(CLINIC_ID, USER_ID),
		]);

		expect(usage.reduce((sum, record) => sum + record.messageCount, 0)).toBe(1);
		expect(usage.reduce((sum, record) => sum + record.totalTokens, 0)).toBe(100);
		expect(byUser.flatMap((record) => record.users).map((user) => user.userName)).toEqual(['Usage User']);
		expect(total).toEqual({ totalMessages: 1, uniqueUsers: 1 });
		expect(providers).toEqual(['anthropic']);
	});

	it('counts the chats of each user for the users filter', async () => {
		await expect(usage.getUserChatCounts(CLINIC_ID)).resolves.toEqual([
			{ userName: 'Other Usage User', chatCount: 1 },
			{ userName: 'Usage User', chatCount: 1 },
		]);
	});

	it('applies user and source filters to the per-user breakdown', async () => {
		const now = new Date();
		await prisma.chatMessage.createMany({
			data: [
				{ id: 'filtered-web', chatId: CHAT_ID, role: 'user', source: 'web', createdAt: now },
				{ id: 'filtered-slack', chatId: CHAT_ID, role: 'user', source: 'slack', createdAt: now },
				{ id: 'filtered-other', chatId: OTHER_USER_CHAT_ID, role: 'user', source: 'web', createdAt: now },
			],
		});

		const byUser = await getMessagesUsageByUser(CLINIC_ID, {
			period: { value: 15, unit: 'day' },
			userNames: ['Usage User'],
			sources: ['slack'],
		});
		const today = byUser.find((record) => record.date === formatDate(now, 'day'));

		expect(today?.users).toEqual([{ userName: 'Usage User', messageCount: 1, totalTokens: 0, totalCost: 0 }]);
	});
});

async function cleanup() {
	await prisma.userPreference.deleteMany({ where: { userId: { in: [USER_ID, OTHER_USER_ID] } } });
	await prisma.llmInference.deleteMany({ where: { clinicId: { in: [CLINIC_ID, OTHER_CLINIC_ID] } } });
	await prisma.chat.deleteMany({ where: { clinicId: { in: [CLINIC_ID, OTHER_CLINIC_ID] } } });
	await prisma.clinic.deleteMany({ where: { id: { in: [CLINIC_ID, OTHER_CLINIC_ID] } } });
	await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
}
