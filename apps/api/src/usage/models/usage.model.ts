import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Messages, tokens and cost (USD) of one chart bucket.' })
export class UsageRecord {
	@Field({ description: 'The bucket: YYYY-MM-DD HH:00, YYYY-MM-DD or YYYY-MM (UTC).' })
	date: string;

	@Field(() => Int)
	messageCount: number;

	@Field(() => Int)
	webMessageCount: number;

	@Field(() => Int)
	slackMessageCount: number;

	@Field(() => Int)
	teamsMessageCount: number;

	@Field(() => Int)
	telegramMessageCount: number;

	@Field(() => Int)
	mattermostMessageCount: number;

	@Field(() => Int)
	discordMessageCount: number;

	@Field(() => Int)
	whatsappMessageCount: number;

	@Field(() => Int)
	adminMessageCount: number;

	@Field(() => Int)
	mcpMessageCount: number;

	@Field(() => Int)
	contextRecommendationsMessageCount: number;

	@Field(() => Float)
	inputNoCacheTokens: number;

	@Field(() => Float)
	inputCacheReadTokens: number;

	@Field(() => Float)
	inputCacheWriteTokens: number;

	@Field(() => Float)
	outputTotalTokens: number;

	@Field(() => Float)
	totalTokens: number;

	@Field(() => Float)
	inputNoCacheCost: number;

	@Field(() => Float)
	inputCacheReadCost: number;

	@Field(() => Float)
	inputCacheWriteCost: number;

	@Field(() => Float)
	outputCost: number;

	@Field(() => Float)
	totalCost: number;
}

@ObjectType()
export class UserUsageBreakdown {
	@Field()
	userName: string;

	@Field(() => Int)
	messageCount: number;

	@Field(() => Float)
	totalTokens: number;

	@Field(() => Float)
	totalCost: number;
}

@ObjectType()
export class UsageByUserRecord {
	@Field()
	date: string;

	@Field(() => [UserUsageBreakdown])
	users: UserUsageBreakdown[];
}

@ObjectType()
export class TotalUsage {
	@Field(() => Int)
	totalMessages: number;

	@Field(() => Int)
	uniqueUsers: number;
}

@ObjectType()
export class UsagePeriodSelection {
	@Field({ description: '24h, 15d, 6m or saved.' })
	mode: string;

	@Field(() => String, { nullable: true })
	savedPeriodId?: string | null;
}

@ObjectType()
export class SavedUsagePeriod {
	@Field(() => ID)
	id: string;

	@Field(() => Int)
	days: number;

	@Field({ description: 'hour, day or month.' })
	granularity: string;
}

@ObjectType({ description: 'The usage period the user picked in the clinic, and the periods they saved.' })
export class UsagePeriodSettings {
	@Field(() => UsagePeriodSelection, { nullable: true })
	selection?: UsagePeriodSelection | null;

	@Field(() => [SavedUsagePeriod])
	savedPeriods: SavedUsagePeriod[];
}

@ObjectType()
export class DeletedSavedUsagePeriod {
	@Field(() => ID)
	id: string;

	@Field(() => UsagePeriodSelection, { nullable: true, description: 'The selection after the delete.' })
	selection?: UsagePeriodSelection | null;
}

@ObjectType({ description: 'A user with chats in the clinic, for the usage filters.' })
export class UsageUserFacet {
	@Field()
	userName: string;

	@Field(() => Int)
	chatCount: number;
}
