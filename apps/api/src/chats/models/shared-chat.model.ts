import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { Chat } from './chat.model.js';

@ObjectType()
export class MessageBubble {
	@Field()
	role: string;

	@Field(() => Int)
	charCount: number;
}

@ObjectType({ description: 'A shared chat (upstream `SharedChatWithDetails`).' })
export class SharedChat {
	@Field(() => ID)
	id: string;

	@Field()
	chatId: string;

	@Field()
	projectId: string;

	@Field()
	userId: string;

	@Field({ description: 'project or specific.' })
	visibility: string;

	@Field()
	createdAt: Date;

	@Field()
	authorName: string;

	@Field()
	title: string;

	@Field(() => GraphQLJSON, { nullable: true })
	forkMetadata?: unknown;

	@Field(() => [MessageBubble], { nullable: true })
	messageBubbles?: MessageBubble[];
}

@ObjectType()
export class SharedChatView {
	@Field(() => SharedChat)
	share: SharedChat;

	@Field(() => Chat)
	chat: Chat;

	@Field(() => String, { nullable: true })
	userRole: string | null;
}

@ObjectType({ description: 'How a chat is shared (upstream `sharedChat.getShareOptionsByChatId`).' })
export class ChatShareOptions {
	@Field(() => String, { nullable: true })
	shareId: string | null;

	@Field(() => String, { nullable: true })
	visibility: string | null;

	@Field(() => [String])
	allowedUserIds: string[];
}

@ObjectType({
	description: 'A project member a chat can be shared with (upstream `project.getProjectMembersByChatId`).',
})
export class ShareableMember {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	email: string;

	@Field()
	role: string;
}
