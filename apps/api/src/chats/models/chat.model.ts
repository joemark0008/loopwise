import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType({ description: 'Who wrote a chat: shown on shared chats and forks.' })
export class ChatAuthor {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true })
	image: string | null;
}

@ObjectType({ description: "A chat (upstream `chat.get`'s `UIChat`). Dates are epoch milliseconds, as upstream." })
export class Chat {
	@Field(() => ID)
	id: string;

	@Field()
	projectId: string;

	@Field()
	title: string;

	@Field()
	isStarred: boolean;

	@Field()
	isOnboarding: boolean;

	@Field(() => Float)
	createdAt: number;

	@Field(() => Float)
	updatedAt: number;

	@Field(() => GraphQLJSON, { nullable: true, description: 'Where the chat was forked from (`ForkMetadata`).' })
	forkMetadata: unknown;

	/** Owner id, for the `author` field. */
	userId: string;
}

@ObjectType({ description: 'A chat in the sidebar list (`GroupedChatItem`).' })
export class ChatListItem {
	@Field(() => ID)
	id: string;

	@Field()
	projectId: string;

	@Field()
	title: string;

	@Field()
	isStarred: boolean;

	@Field()
	isOnboarding: boolean;

	@Field(() => Float)
	createdAt: number;

	@Field(() => Float)
	updatedAt: number;

	@Field({ description: 'own or shared.' })
	kind: string;

	@Field(() => String, { nullable: true })
	shareId?: string | null;

	@Field()
	ownerName: string;
}

@ObjectType()
export class ChatGroup {
	@Field(() => String, { nullable: true })
	label: string | null;

	@Field(() => [ChatListItem])
	chats: ChatListItem[];
}

@ObjectType({ description: 'Upstream `chat.listGrouped`.' })
export class GroupedChatList {
	@Field(() => [ChatGroup])
	groups: ChatGroup[];
}

@ObjectType()
export class ChatSearchResult {
	@Field(() => ID)
	id: string;

	@Field()
	title: string;

	@Field(() => Float)
	createdAt: number;

	@Field(() => Float)
	updatedAt: number;

	@Field(() => String, { nullable: true })
	matchedText?: string | null;
}

@ObjectType()
export class CancelChatResult {
	@Field({ description: 'deleted or kept.' })
	outcome: string;

	@Field()
	chatDeleted: boolean;
}

@ObjectType()
export class ContextUsage {
	@Field(() => Int)
	tokensUsed: number;

	@Field(() => Int, { nullable: true })
	contextWindow: number | null;
}

@ObjectType({ description: 'A page of a stored query result (upstream `chat.getQueryRows`).' })
export class QueryRowsPage {
	@Field(() => [String])
	columns: string[];

	@Field(() => [GraphQLJSON])
	rows: Record<string, unknown>[];

	@Field(() => Int)
	totalRows: number;
}

@ObjectType()
export class ChatIdResult {
	@Field(() => ID)
	chatId: string;
}

@ObjectType()
export class QuickQuestionChat {
	@Field(() => ID)
	chatId: string;

	@Field()
	title: string;

	@Field()
	updatedAt: Date;
}

@ObjectType()
export class MessageFeedback {
	@Field(() => ID)
	messageId: string;

	@Field()
	vote: string;

	@Field(() => String, { nullable: true })
	explanation: string | null;

	@Field()
	createdAt: Date;
}

@ObjectType({ description: 'A saved SQL edit (upstream `sql.updateQuery`).' })
export class SqlEditResult {
	@Field(() => GraphQLJSON, { description: '`execute_sql` input.' })
	input: unknown;

	@Field(() => GraphQLJSON, { description: '`execute_sql` output.' })
	output: unknown;

	@Field()
	toolCallId: string;

	@Field()
	chatId: string;
}
