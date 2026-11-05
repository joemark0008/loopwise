import type { ChatFilterType, ChatGroupBy } from '@loopwise/shared/types';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { UIMessage } from '../agent/types/chat.js';
import type { AuthUser } from '../auth/auth.service.js';
import { Loaders } from '../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../common/dataloader/request-loaders.js';
import { ClinicAccess, ClinicAdmin } from '../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { UserLoader } from '../users/user.loader.js';
import { ChatMessagesLoader } from './chat.loader.js';
import { ChatsService } from './chats.service.js';
import { CitationService } from './citation.service.js';
import {
	ChatContextUsageInput,
	ChatListInput,
	MessageFeedbackInput,
	QueryRowsInput,
	RenameChatInput,
} from './dto/chat.input.js';
import { FeedbackService } from './feedback.service.js';
import {
	CancelChatResult,
	Chat,
	ChatAuthor,
	ChatSearchResult,
	ContextUsage,
	GroupedChatList,
	MessageFeedback,
	QueryRowsPage,
	RecentFeedback,
} from './models/chat.model.js';
import { QueryRowsService } from './query-rows.service.js';

/** Upstream tRPC `chat.*`, `citation.get` and `feedback.submit` / `getRecent`. */
@Resolver(() => Chat)
export class ChatsResolver {
	constructor(
		private readonly chatsService: ChatsService,
		private readonly queryRowsService: QueryRowsService,
		private readonly citations: CitationService,
		private readonly feedback: FeedbackService,
	) {}

	@Query(() => Chat, { description: "The user's own chat (upstream `chat.get`)." })
	chat(@CurrentUser() user: AuthUser, @Args('chatId', { type: () => ID }) chatId: string): Promise<Chat> {
		return this.chatsService.getOwnChat(chatId, user.id);
	}

	@ResolveField(() => [GraphQLJSON], {
		description: 'Active messages (`UIMessage[]`), query results cut to a preview.',
	})
	async messages(@Parent() chat: Chat, @Loaders() loaders: RequestLoaders): Promise<UIMessage[]> {
		return (await loaders.get(ChatMessagesLoader).load(chat.id)) ?? [];
	}

	@ResolveField(() => ChatAuthor, { nullable: true })
	async author(@Parent() chat: Chat, @Loaders() loaders: RequestLoaders): Promise<ChatAuthor | null> {
		const user = await loaders.get(UserLoader).load(chat.userId);
		return user && { id: user.id, name: user.name, image: user.image };
	}

	@Query(() => GroupedChatList, { description: 'Upstream `chat.listGrouped`.' })
	chatList(
		@CurrentUser() user: AuthUser,
		@Args('input', { type: () => ChatListInput, nullable: true }) input?: ChatListInput,
	): Promise<GroupedChatList> {
		return this.chatsService.listGrouped(
			user.id,
			(input?.groupBy ?? 'none') as ChatGroupBy,
			(input?.filters ?? ['all']) as ChatFilterType[],
		);
	}

	@Query(() => [ChatSearchResult])
	searchChats(
		@CurrentUser() user: AuthUser,
		@Args('query') query: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
	): Promise<ChatSearchResult[]> {
		return this.chatsService.search(user.id, query.slice(0, 255), limit && Math.min(Math.max(limit, 1), 50));
	}

	@Query(() => GraphQLJSON, { nullable: true, description: 'Upstream `chat.getForkMetadata`.' })
	chatForkMetadata(@CurrentUser() user: AuthUser, @Args('chatId', { type: () => ID }) chatId: string) {
		return this.chatsService.getForkMetadata(chatId, user.id);
	}

	@Query(() => ContextUsage, { description: 'Upstream `chat.getContextUsage`.' })
	chatContextUsage(
		@CurrentUser() user: AuthUser,
		@Args('input') input: ChatContextUsageInput,
	): Promise<ContextUsage> {
		return this.chatsService.getContextUsage(input.chatId, user.id, input.model);
	}

	@Query(() => QueryRowsPage, { description: 'Upstream `chat.getQueryRows`.' })
	queryRows(@CurrentUser() user: AuthUser, @Args('input') input: QueryRowsInput): Promise<QueryRowsPage> {
		return this.queryRowsService.getQueryRowsForUser(input, user.id);
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'SQL and column lineage behind a cited value (upstream `citation.get`).' })
	citation(@CurrentClinic() clinic: Clinic, @Args('queryId') queryId: string, @Args('column') column: string) {
		return this.citations.getCitation(clinic.id, queryId, column);
	}

	@Mutation(() => Boolean)
	async deleteChat(@CurrentUser() user: AuthUser, @Args('chatId', { type: () => ID }) chatId: string) {
		await this.chatsService.deleteChat(chatId, user.id);
		return true;
	}

	@Mutation(() => Boolean, { description: 'Stops the running agent of a chat (the Stop button).' })
	async stopChat(@CurrentUser() user: AuthUser, @Args('chatId', { type: () => ID }) chatId: string) {
		await this.chatsService.stopChat(chatId, user.id);
		return true;
	}

	@Mutation(() => CancelChatResult)
	cancelChat(@CurrentUser() user: AuthUser, @Args('chatId', { type: () => ID }) chatId: string) {
		return this.chatsService.cancelChat(chatId, user.id);
	}

	@Mutation(() => Boolean)
	async renameChat(@CurrentUser() user: AuthUser, @Args('input') input: RenameChatInput) {
		await this.chatsService.renameChat(input.chatId, user.id, input.title);
		return true;
	}

	@Mutation(() => Int, { description: 'Deletes every chat that is not starred; returns how many.' })
	deleteAllNonStarredChats(@CurrentUser() user: AuthUser): Promise<number> {
		return this.chatsService.deleteAllNonStarred(user.id);
	}

	@Mutation(() => Boolean)
	async setChatStarred(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
		@Args('isStarred') isStarred: boolean,
	) {
		await this.chatsService.setStarred(chatId, user.id, isStarred);
		return true;
	}

	@Mutation(() => Boolean)
	async switchMessageVersion(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
		@Args('messageId', { type: () => ID }) messageId: string,
	) {
		await this.chatsService.switchMessageVersion(chatId, user.id, messageId);
		return true;
	}

	@ClinicAccess()
	@Mutation(() => MessageFeedback, { description: 'Upstream `feedback.submit`.' })
	submitMessageFeedback(@CurrentUser() user: AuthUser, @Args('input') input: MessageFeedbackInput) {
		return this.feedback.submit(user.id, input);
	}

	@ClinicAdmin()
	@Query(() => [RecentFeedback], { description: 'Upstream `feedback.getRecent`.' })
	recentFeedbacks(
		@CurrentClinic() clinic: Clinic,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
	): Promise<RecentFeedback[]> {
		return this.feedback.listRecent(clinic.id, limit ? Math.min(Math.max(limit, 1), 50) : 10);
	}
}
