import { CHAT_FILTER_OPTIONS, CHAT_GROUP_BY_OPTIONS } from '@loopwise/shared/types';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested,
} from 'class-validator';

const MAX_QUERY_ROWS_PAGE_SIZE = 1000;

@InputType()
export class ChatListInput {
	@Field({ defaultValue: 'none', description: 'star, date, clinic, ownership, sourcePlatform or none.' })
	@IsOptional()
	@IsIn(CHAT_GROUP_BY_OPTIONS)
	groupBy: string;

	@Field(() => [String], { defaultValue: ['all'], description: 'all, mine, starred, shared, shared_with_me.' })
	@IsOptional()
	@IsArray()
	@IsIn(CHAT_FILTER_OPTIONS, { each: true })
	filters: string[];
}

@InputType()
export class ModelSelectionInput {
	@Field()
	@IsString()
	provider: string;

	@Field()
	@IsString()
	modelId: string;
}

@InputType()
export class QuerySortInput {
	@Field()
	@IsString()
	column: string;

	@Field({ description: 'asc or desc.' })
	@IsIn(['asc', 'desc'])
	direction: 'asc' | 'desc';
}

@InputType()
export class QueryRowsInput {
	@Field(() => ID)
	chatId: string;

	@Field()
	@IsString()
	toolCallId: string;

	@Field()
	@IsString()
	queryId: string;

	@Field(() => Int, { defaultValue: 0 })
	@IsInt()
	@Min(0)
	offset: number;

	@Field(() => Int, { nullable: true, description: 'Every row from `offset` when omitted.' })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(MAX_QUERY_ROWS_PAGE_SIZE)
	limit?: number;

	@Field(() => QuerySortInput, { nullable: true })
	@IsOptional()
	@ValidateNested()
	@Type(() => QuerySortInput)
	sort?: QuerySortInput;
}

@InputType()
export class RenameChatInput {
	@Field(() => ID)
	chatId: string;

	@Field()
	@MinLength(1)
	@MaxLength(255)
	title: string;
}

@InputType()
export class SelectionInput {
	@Field(() => Int)
	@IsInt()
	start: number;

	@Field(() => Int)
	@IsInt()
	end: number;

	@Field()
	@IsString()
	text: string;
}

@InputType()
export class CreateSharedChatInput {
	@Field(() => ID)
	chatId: string;

	@Field({ defaultValue: 'clinic', description: 'clinic or specific.' })
	@IsIn(['clinic', 'specific'])
	visibility: 'clinic' | 'specific';

	@Field(() => [String], { nullable: true })
	@IsOptional()
	@IsArray()
	allowedUserIds?: string[];

	@Field({ defaultValue: false, description: 'Also notify recipients outside the app (Phase 5 notifications).' })
	notify: boolean;
}

@InputType()
export class MessageFeedbackInput {
	@Field(() => ID)
	chatId: string;

	@Field(() => ID)
	messageId: string;

	@Field({ description: 'up or down.' })
	@IsIn(['up', 'down'])
	vote: 'up' | 'down';

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	explanation?: string;
}

@InputType()
export class ChatContextUsageInput {
	@Field(() => ID)
	chatId: string;

	@Field(() => ModelSelectionInput, { nullable: true })
	@IsOptional()
	@ValidateNested()
	@Type(() => ModelSelectionInput)
	model?: ModelSelectionInput;
}

@InputType()
export class ForkSharedChatInput {
	@Field(() => ID)
	@IsString()
	shareId: string;

	@Field(() => SelectionInput, { nullable: true })
	@IsOptional()
	@ValidateNested()
	@Type(() => SelectionInput)
	selection?: SelectionInput;
}

@InputType()
export class SqlEditInput {
	@Field()
	@Matches(/^query_.+$/)
	queryId: string;

	@Field()
	@MinLength(1)
	sqlQuery: string;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	databaseId?: string | null;

	@Field(() => String, { nullable: true })
	@IsOptional()
	@IsString()
	name?: string | null;
}
