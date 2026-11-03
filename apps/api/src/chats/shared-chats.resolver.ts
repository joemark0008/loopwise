import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { UserRole } from '@quarry/shared/types';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectNonViewer } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { ChatForkService } from './chat-fork.service.js';
import { CreateSharedChatInput, ForkSharedChatInput } from './dto/chat.input.js';
import { ChatIdResult, QuickQuestionChat } from './models/chat.model.js';
import { ChatShareOptions, ShareableMember, SharedChat, SharedChatView } from './models/shared-chat.model.js';
import { SharedChatsService } from './shared-chats.service.js';

/** Upstream tRPC `sharedChat.*` and the shared-chat procedures of `chatFork.*`. */
@Resolver(() => SharedChat)
export class SharedChatsResolver {
	constructor(
		private readonly sharedChatsService: SharedChatsService,
		private readonly forks: ChatForkService,
	) {}

	@Query(() => [SharedChat], { description: 'Chats shared in the projects the user can access.' })
	sharedChats(@CurrentUser() user: AuthUser): Promise<SharedChat[]> {
		return this.sharedChatsService.list(user.id);
	}

	@Query(() => SharedChatView)
	sharedChat(
		@CurrentUser() user: AuthUser,
		@Args('shareId', { type: () => ID }) shareId: string,
	): Promise<SharedChatView> {
		return this.sharedChatsService.getSharedChat(shareId, user.id);
	}

	@Query(() => ChatShareOptions)
	chatShareOptions(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
	): Promise<ChatShareOptions> {
		return this.sharedChatsService.getShareOptionsByChatId(chatId, user.id);
	}

	@Query(() => [ShareableMember])
	chatShareMembers(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
	): Promise<ShareableMember[]> {
		return this.sharedChatsService.listShareableMembers(chatId, user.id);
	}

	@ProjectNonViewer()
	@Mutation(() => SharedChat)
	async createSharedChat(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@CurrentUserRole() userRole: UserRole,
		@Args('input') input: CreateSharedChatInput,
	): Promise<SharedChat> {
		const created = await this.sharedChatsService.create(
			{ projectId: project.id, userId: user.id, userRole },
			input,
		);
		return this.sharedChatsService.getSharedChatDetails(created.id);
	}

	@Mutation(() => Boolean)
	async updateSharedChatAccess(
		@CurrentUser() user: AuthUser,
		@Args('shareId', { type: () => ID }) shareId: string,
		@Args('allowedUserIds', { type: () => [String] }) allowedUserIds: string[],
	) {
		await this.sharedChatsService.updateAccess(shareId, user.id, allowedUserIds);
		return true;
	}

	@Mutation(() => Boolean)
	async deleteSharedChat(@CurrentUser() user: AuthUser, @Args('shareId', { type: () => ID }) shareId: string) {
		await this.sharedChatsService.delete(shareId, user.id);
		return true;
	}

	@ProjectNonViewer()
	@Mutation(() => ChatIdResult, {
		description: 'Forks a shared chat, or a selection of it (upstream `chatFork.fork`).',
	})
	forkSharedChat(@CurrentUser() user: AuthUser, @Args('input') input: ForkSharedChatInput): Promise<ChatIdResult> {
		return this.forks.forkSharedChat(input.shareId, user.id, input.selection, 'fork');
	}

	@ProjectNonViewer()
	@Mutation(() => ChatIdResult, {
		description: 'A quick question about a shared chat, kept out of the chat history.',
	})
	askSharedChat(@CurrentUser() user: AuthUser, @Args('input') input: ForkSharedChatInput): Promise<ChatIdResult> {
		return this.forks.forkSharedChat(input.shareId, user.id, input.selection, 'question');
	}

	@Query(() => [QuickQuestionChat])
	sharedChatQuickQuestions(
		@CurrentUser() user: AuthUser,
		@Args('shareId', { type: () => ID }) shareId: string,
	): Promise<QuickQuestionChat[]> {
		return this.forks.listSharedChatQuickQuestions(shareId, user.id);
	}
}
