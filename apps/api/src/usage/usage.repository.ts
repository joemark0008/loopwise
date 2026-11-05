import type { LlmProvider } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
	type Granularity,
	resolveUsageChartGranularity,
	type TotalUsageRecord,
	type UsageByUserRecord,
	type UsageFilter,
	type UsagePeriodRange,
	type UsageRecord,
	type UsageSource,
	type UserUsageBreakdown,
} from './usage.types.js';
import type { ModelCostRow } from './usage-costs.js';
import { fillMissingDates, generateDateSeries, getLookbackTimestamp } from './usage-date.js';

type UsageByUserRow = UserUsageBreakdown & { date: string };

const PG_FORMATS: Record<Granularity, string> = {
	hour: 'YYYY-MM-DD HH24:00',
	day: 'YYYY-MM-DD',
	month: 'YYYY-MM',
};

/** `UsageRecord` message counters and the `chat_messages.source` each one counts. */
const SOURCE_COUNTERS = [
	['webMessageCount', 'web'],
	['slackMessageCount', 'slack'],
	['teamsMessageCount', 'teams'],
	['telegramMessageCount', 'telegram'],
	['mattermostMessageCount', 'mattermost'],
	['discordMessageCount', 'discord'],
	['whatsappMessageCount', 'whatsapp'],
	['adminMessageCount', 'admin'],
	['mcpMessageCount', 'mcp'],
	['contextRecommendationsMessageCount', 'contextRecommendations'],
] as const satisfies ReadonlyArray<readonly [keyof UsageRecord, UsageSource]>;

const TOKEN_COLUMNS = [
	['inputNoCacheTokens', 'input_no_cache_tokens'],
	['inputCacheReadTokens', 'input_cache_read_tokens'],
	['inputCacheWriteTokens', 'input_cache_write_tokens'],
	['outputTotalTokens', 'output_total_tokens'],
	['totalTokens', 'total_tokens'],
] as const satisfies ReadonlyArray<readonly [keyof UsageRecord, string]>;

/** Cost of each token column, from `cost_lookup` (USD per million tokens). */
const COST_COLUMNS = [
	['inputNoCacheCost', 'input_no_cache_tokens', 'input_no_cache'],
	['inputCacheReadCost', 'input_cache_read_tokens', 'input_cache_read'],
	['inputCacheWriteCost', 'input_cache_write_tokens', 'input_cache_write'],
	['outputCost', 'output_total_tokens', 'output'],
] as const satisfies ReadonlyArray<readonly [keyof UsageRecord, string, string]>;

/** Who sent a chat message: the sender of a shared chat's message, else the chat's owner. */
const MESSAGE_SENDER = Prisma.sql`coalesce(cm.sender_user_id, c.user_id)`;

/** The provider a user message was answered with: the one of the next assistant message of the same turn. */
const MESSAGE_USAGE_PROVIDER = Prisma.sql`case
	when cm.role = 'user' then (
		select next_message.llm_provider
		from chat_messages as next_message
		where next_message.chat_id = cm.chat_id
			and next_message.role = 'assistant'
			and next_message.llm_provider is not null
			and next_message.created_at > cm.created_at
			and not exists (
				select 1
				from chat_messages as next_user_message
				where next_user_message.chat_id = cm.chat_id
					and next_user_message.role = 'user'
					and next_user_message.created_at > cm.created_at
					and next_user_message.created_at < next_message.created_at
			)
		order by next_message.created_at asc
		limit 1
	)
	else cm.llm_provider
end`;

/** The source of an assistant message: the one of the user message it answers. */
const MESSAGE_USAGE_SOURCE = Prisma.sql`case
	when cm.role = 'assistant' then (
		select source_message.source
		from chat_messages as source_message
		where source_message.chat_id = cm.chat_id
			and source_message.role = 'user'
			and source_message.created_at <= cm.created_at
		order by source_message.created_at desc
		limit 1
	)
	else cm.source
end`;

/** The source of an inference: the one of the latest user message of its chat. */
const INFERENCE_USAGE_SOURCE = Prisma.sql`(
	select source_message.source
	from chat_messages as source_message
	where source_message.chat_id = li.chat_id
		and source_message.role = 'user'
		and source_message.created_at <= li.created_at
	order by source_message.created_at desc
	limit 1
)`;

const USER_MESSAGE_COUNT = Prisma.sql`count(distinct case when cm.role = 'user' then cm.id end)`;

/**
 * Port of upstream `queries/usage.queries.ts` on Postgres. Usage combines the tokens of assistant messages
 * (`chat_messages`) with those of the other model calls (`llm_inferences`); costs come from the `cost_lookup` table
 * the caller builds from the model catalogue and the clinic's custom model prices.
 */
@Injectable()
export class UsageRepository {
	constructor(private readonly prisma: PrismaService) {}

	async getMessagesUsage(
		clinicId: string,
		filter: UsageFilter,
		costs: ModelCostRow[],
		userId?: string,
	): Promise<UsageRecord[]> {
		const { period } = filter;
		const granularity = filter.granularity ?? resolveUsageChartGranularity(period);
		const { messageWhere, inferenceWhere } = buildUsageWhere(clinicId, filter, userId);
		const zero = Prisma.sql`0`;

		const messageColumns = [
			USER_MESSAGE_COUNT,
			...SOURCE_COUNTERS.map(
				([, source]) =>
					Prisma.sql`count(distinct case when cm.role = 'user' and cm.source = ${source} then cm.id end)`,
			),
			...TOKEN_COLUMNS.map(([, column]) => Prisma.sql`sum(cm.${Prisma.raw(column)})`),
			...COST_COLUMNS.map(([, tokens, price]) => costOf('cm', tokens, price)),
		];
		const inferenceColumns = [
			zero,
			...SOURCE_COUNTERS.map(() => zero),
			...TOKEN_COLUMNS.map(([, column]) => Prisma.sql`sum(li.${Prisma.raw(column)})`),
			...COST_COLUMNS.map(([, tokens, price]) => costOf('li', tokens, price)),
		];
		const names = ['message_count', ...SOURCE_COUNTERS.map(([key]) => key), ...TOKEN_COLUMNS.map(([key]) => key)]
			.concat(COST_COLUMNS.map(([key]) => key))
			.map((name) => Prisma.raw(`"${name}"`));

		const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
			with ${costLookup(costs)},
			message_usage as (
				select ${dateOf('cm', granularity)} as date, ${aliased(messageColumns, names)}
				from chat_messages cm
				join chats c on cm.chat_id = c.id
				join users u on ${MESSAGE_SENDER} = u.id
				left join cost_lookup cl on cl.provider = cm.llm_provider and cl.model_id = cm.llm_model_id
				where ${messageWhere}
				group by 1
			),
			inference_usage as (
				select ${dateOf('li', granularity)} as date, ${aliased(inferenceColumns, names)}
				from llm_inferences li
				join users u on li.user_id = u.id
				left join cost_lookup cl on cl.provider = li.llm_provider and cl.model_id = li.llm_model_id
				where ${inferenceWhere}
				group by 1
			)
			select date, ${Prisma.join(
				names.map((name) => Prisma.sql`sum(${name}) as ${name}`),
				', ',
			)}
			from (select * from message_usage union all select * from inference_usage) combined
			group by date`;

		return fillMissingDates(rows.map(normalizeMessageUsageRow), period, granularity);
	}

	async getMessagesUsageByUser(
		clinicId: string,
		filter: UsageFilter,
		costs: ModelCostRow[],
		userId?: string,
	): Promise<UsageByUserRecord[]> {
		const { period } = filter;
		const granularity = filter.granularity ?? resolveUsageChartGranularity(period);
		const { messageWhere, inferenceWhere } = buildUsageWhere(clinicId, filter, userId);

		const rows = await this.prisma.$queryRaw<
			Array<{
				date: string;
				user_name: string;
				message_count: unknown;
				total_tokens: unknown;
				total_cost: unknown;
			}>
		>`
			with ${costLookup(costs)},
			message_usage as (
				select ${dateOf('cm', granularity)} as date, u.name as user_name,
					${USER_MESSAGE_COUNT} as message_count,
					sum(cm.total_tokens) as total_tokens,
					${totalCostOf('cm')} as total_cost
				from chat_messages cm
				join chats c on cm.chat_id = c.id
				join users u on ${MESSAGE_SENDER} = u.id
				left join cost_lookup cl on cl.provider = cm.llm_provider and cl.model_id = cm.llm_model_id
				where ${messageWhere}
				group by 1, 2
			),
			inference_usage as (
				select ${dateOf('li', granularity)} as date, u.name as user_name,
					0 as message_count,
					sum(li.total_tokens) as total_tokens,
					${totalCostOf('li')} as total_cost
				from llm_inferences li
				join users u on li.user_id = u.id
				left join cost_lookup cl on cl.provider = li.llm_provider and cl.model_id = li.llm_model_id
				where ${inferenceWhere}
				group by 1, 2
			)
			select date, user_name, sum(message_count) as message_count, sum(total_tokens) as total_tokens,
				sum(total_cost) as total_cost
			from (select * from message_usage union all select * from inference_usage) combined
			group by date, user_name`;

		return groupUsageByDate(
			rows.map((row) => ({
				date: row.date,
				userName: row.user_name,
				messageCount: Number(row.message_count ?? 0),
				totalTokens: Number(row.total_tokens ?? 0),
				totalCost: Number(row.total_cost ?? 0),
			})),
			period,
			granularity,
		);
	}

	async getTotalUsage(clinicId: string, filter: UsageFilter, userId?: string): Promise<TotalUsageRecord> {
		const { messageWhere } = buildUsageWhere(clinicId, filter, userId);
		const [row] = await this.prisma.$queryRaw<Array<{ total_messages: unknown; unique_users: unknown }>>`
			select ${USER_MESSAGE_COUNT} as total_messages, count(distinct ${MESSAGE_SENDER}) as unique_users
			from chat_messages cm
			join chats c on cm.chat_id = c.id
			join users u on ${MESSAGE_SENDER} = u.id
			where ${messageWhere}`;

		return {
			totalMessages: Number(row?.total_messages ?? 0),
			uniqueUsers: Number(row?.unique_users ?? 0),
		};
	}

	/** The users filter of the usage page (upstream took it from the chat replay facets): chat count per user name. */
	async getUserChatCounts(clinicId: string): Promise<Array<{ userName: string; chatCount: number }>> {
		const rows = await this.prisma.$queryRaw<Array<{ user_name: string; chat_count: bigint }>>`
			select u.name as user_name, count(distinct c.id) as chat_count
			from chats c
			join users u on c.user_id = u.id
			where c.clinic_id = ${clinicId}::uuid
			group by u.name
			order by u.name`;
		return rows.map((row) => ({ userName: row.user_name, chatCount: Number(row.chat_count) }));
	}

	async getUsedProviders(clinicId: string, userId?: string): Promise<LlmProvider[]> {
		const [messageRows, inferenceRows] = await Promise.all([
			this.prisma.$queryRaw<Array<{ provider: string }>>`
				select distinct cm.llm_provider as provider
				from chat_messages cm
				join chats c on cm.chat_id = c.id
				where c.clinic_id = ${clinicId}::uuid
					and cm.llm_provider is not null
					${userId ? Prisma.sql`and ${MESSAGE_SENDER} = ${userId}::uuid` : Prisma.empty}`,
			this.prisma.llmInference.findMany({
				where: { clinicId, ...(userId && { userId }) },
				distinct: ['llmProvider'],
				select: { llmProvider: true },
			}),
		]);

		return [
			...new Set([
				...messageRows.map((row) => row.provider as LlmProvider),
				...inferenceRows.map((row) => row.llmProvider as LlmProvider),
			]),
		];
	}
}

/** `cost_lookup(provider, model_id, input_no_cache, input_cache_read, input_cache_write, output)`. */
function costLookup(costs: ModelCostRow[]): Prisma.Sql {
	const columns = Prisma.raw('provider, model_id, input_no_cache, input_cache_read, input_cache_write, output');
	if (costs.length === 0) {
		return Prisma.sql`cost_lookup(${columns}) as (
			select null::text, null::text, 0::double precision, 0::double precision, 0::double precision,
				0::double precision
			where false
		)`;
	}
	const rows = costs.map(
		(cost) =>
			Prisma.sql`(${cost.provider}::text, ${cost.modelId}::text, ${cost.inputNoCache}::double precision, ${cost.inputCacheRead}::double precision, ${cost.inputCacheWrite}::double precision, ${cost.output}::double precision)`,
	);
	return Prisma.sql`cost_lookup(${columns}) as (values ${Prisma.join(rows, ', ')})`;
}

function costOf(table: 'cm' | 'li', tokens: string, price: string): Prisma.Sql {
	return Prisma.sql`sum(coalesce(${Prisma.raw(`${table}.${tokens}`)}, 0) * coalesce(${Prisma.raw(`cl.${price}`)}, 0) / 1000000.0)`;
}

function totalCostOf(table: 'cm' | 'li'): Prisma.Sql {
	return Prisma.join(
		COST_COLUMNS.map(([, tokens, price]) => costOf(table, tokens, price)),
		' + ',
	);
}

function aliased(columns: Prisma.Sql[], names: Prisma.Sql[]): Prisma.Sql {
	return Prisma.join(
		columns.map((column, index) => Prisma.sql`${column} as ${names[index]}`),
		', ',
	);
}

function dateOf(table: 'cm' | 'li', granularity: Granularity): Prisma.Sql {
	const utc = Prisma.raw(`(${table}.created_at at time zone 'UTC')`);
	return Prisma.sql`to_char(${utc}, ${Prisma.raw(`'${PG_FORMATS[granularity]}'`)})`;
}

/** The lookback instant (ISO, UTC); `created_at` is a timestamptz and the buckets are UTC dates. */
function lookbackOf(period: UsagePeriodRange): string {
	return new Date(getLookbackTimestamp(period)).toISOString();
}

function buildUsageWhere(clinicId: string, filter: UsageFilter, userId?: string) {
	const lookback = lookbackOf(filter.period);
	const message = [
		Prisma.sql`c.clinic_id = ${clinicId}::uuid`,
		Prisma.sql`cm.created_at >= ${lookback}::timestamptz`,
	];
	const inference = [
		Prisma.sql`li.clinic_id = ${clinicId}::uuid`,
		Prisma.sql`li.created_at >= ${lookback}::timestamptz`,
	];

	if (filter.provider) {
		message.push(Prisma.sql`(${MESSAGE_USAGE_PROVIDER}) = ${filter.provider}`);
		inference.push(Prisma.sql`li.llm_provider = ${filter.provider}`);
	}
	if (userId) {
		message.push(Prisma.sql`${MESSAGE_SENDER} = ${userId}::uuid`);
		inference.push(Prisma.sql`li.user_id = ${userId}::uuid`);
	} else {
		const names = filter.userNames?.filter(Boolean) ?? [];
		if (names.length > 0) {
			message.push(Prisma.sql`u.name in (${Prisma.join(names)})`);
			inference.push(Prisma.sql`u.name in (${Prisma.join(names)})`);
		}
	}
	if (filter.sources?.length) {
		message.push(Prisma.sql`(${MESSAGE_USAGE_SOURCE}) in (${Prisma.join(filter.sources)})`);
		inference.push(Prisma.sql`${INFERENCE_USAGE_SOURCE} in (${Prisma.join(filter.sources)})`);
	}

	return { messageWhere: Prisma.join(message, ' and '), inferenceWhere: Prisma.join(inference, ' and ') };
}

function normalizeMessageUsageRow(row: Record<string, unknown>): UsageRecord {
	const read = (key: string) => Number(row[key] ?? 0);
	const inputNoCacheCost = read('inputNoCacheCost');
	const inputCacheReadCost = read('inputCacheReadCost');
	const inputCacheWriteCost = read('inputCacheWriteCost');
	const outputCost = read('outputCost');

	return {
		date: row.date as string,
		messageCount: read('message_count'),
		...(Object.fromEntries(SOURCE_COUNTERS.map(([key]) => [key, read(key)])) as Pick<
			UsageRecord,
			(typeof SOURCE_COUNTERS)[number][0]
		>),
		...(Object.fromEntries(TOKEN_COLUMNS.map(([key]) => [key, read(key)])) as Pick<
			UsageRecord,
			(typeof TOKEN_COLUMNS)[number][0]
		>),
		inputNoCacheCost,
		inputCacheReadCost,
		inputCacheWriteCost,
		outputCost,
		totalCost: inputNoCacheCost + inputCacheReadCost + inputCacheWriteCost + outputCost,
	};
}

function groupUsageByDate(
	rows: UsageByUserRow[],
	period: UsagePeriodRange,
	granularity: Granularity,
): UsageByUserRecord[] {
	const usersByDate = new Map<string, UserUsageBreakdown[]>();
	for (const { date, ...user } of rows) {
		const users = usersByDate.get(date) ?? [];
		users.push(user);
		usersByDate.set(date, users);
	}

	return generateDateSeries(period, granularity).map((date) => ({ date, users: usersByDate.get(date) ?? [] }));
}
