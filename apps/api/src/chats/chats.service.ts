import type { ChatFilterType, ChatGroupBy, GroupedChatListResponse, LlmProvider } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { AgentService } from '../agent/agent.service.js';
import type { ContextUsage, ForkMetadata, UIMessage } from '../agent/types/chat.js';
import { applyChatFilters, buildChatGroups, type EnrichedChat } from '../agent/utils/chat-list.js';
import { withQueryResultPreviewsInChat } from '../agent/utils/query-result-preview.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ChatRepository, type SearchChatResult } from './chat.repository.js';
import type { Chat } from './models/chat.model.js';

const CANCEL_WAIT_MS = 10_000;

/** Port of upstream `trpc/chat.routes.ts` (minus `download`, which comes with chat export). */
@Injectable()
export class ChatsService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly agents: AgentService,
	) {}

	/** Upstream `chat.get`: the owner's chat; messages are resolved by `Chat.messages`. */
	async getOwnChat(chatId: string, userId: string): Promise<Chat> {
		const chat = await this.getChatSummary(chatId);
		if (chat.userId !== userId) {
			throw new HandlerError('FORBIDDEN', 'You are not authorized to access this chat.');
		}
		return chat;
	}

	async getChatSummary(chatId: string): Promise<Chat> {
		const chat = await this.chats.getChatSummary(chatId);
		if (!chat) {
			throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
		}
		return {
			id: chat.id,
			clinicId: chat.clinicId,
			userId: chat.userId,
			title: chat.title,
			isStarred: chat.isStarred,
			isOnboarding: chat.isOnboarding,
			createdAt: chat.createdAt.getTime(),
			updatedAt: chat.updatedAt.getTime(),
			forkMetadata: (chat.forkMetadata as ForkMetadata | null) ?? null,
			automationRun: null,
		};
	}

	/** Active messages with query results cut to their preview, as upstream's `withQueryResultPreviewsInChat`. */
	async getMessagesByChatIds(chatIds: readonly string[]): Promise<UIMessage[][]> {
		const byChat = await this.chats.getMessagesByChatIds(chatIds);
		return chatIds.map((chatId) => withQueryResultPreviewsInChat({ messages: byChat.get(chatId) ?? [] }).messages);
	}

	async listGrouped(
		userId: string,
		groupBy: ChatGroupBy,
		filters: ChatFilterType[],
	): Promise<GroupedChatListResponse> {
		const effective = filters.length === 0 || filters.includes('all') ? (['all'] as ChatFilterType[]) : filters;
		const needsShared = effective.includes('shared_with_me') || groupBy === 'ownership';
		const [ownItems, sharedItems] = await Promise.all([
			this.chats.listOwnChats(userId),
			needsShared ? this.chats.listSharedWithMeChats(userId) : Promise.resolve([]),
		]);
		const allItems = [...ownItems, ...sharedItems] as EnrichedChat[];
		return { groups: buildChatGroups(applyChatFilters(allItems, effective), groupBy) };
	}

	search(userId: string, query: string, limit?: number): Promise<SearchChatResult[]> {
		return this.chats.searchUserChats(userId, query, limit);
	}

	async deleteChat(chatId: string, userId: string): Promise<void> {
		await this.assertOwner(chatId, userId);
		await this.chats.deleteChat(chatId);
	}

	async stopChat(chatId: string, userId: string): Promise<void> {
		if (!this.agents.stop(chatId, userId)) {
			throw new HandlerError('NOT_FOUND', `Agent with id ${chatId} not found.`);
		}
	}

	/** Upstream `chat.cancel`: stops the run, then drops the turn when nothing was answered yet. */
	async cancelChat(chatId: string, userId: string): Promise<{ outcome: 'deleted' | 'kept'; chatDeleted: boolean }> {
		await this.assertOwner(chatId, userId);
		const agent = this.agents.get(chatId);
		if (agent) {
			agent.stop();
			await Promise.race([agent.waitUntilFinished(), delay(CANCEL_WAIT_MS)]);
		}
		return this.chats.deleteLastEmptyTurn(chatId);
	}

	async renameChat(chatId: string, userId: string, title: string): Promise<void> {
		await this.assertOwner(chatId, userId);
		await this.chats.renameChat(chatId, title);
	}

	async deleteAllNonStarred(userId: string): Promise<number> {
		const { count } = await this.chats.deleteNonStarredChats(userId);
		return count;
	}

	async setStarred(chatId: string, userId: string, isStarred: boolean): Promise<void> {
		await this.assertOwner(chatId, userId);
		await this.chats.toggleStarred(chatId, isStarred);
	}

	async switchMessageVersion(chatId: string, userId: string, messageId: string): Promise<void> {
		await this.assertOwner(chatId, userId);
		await this.chats.switchMessageVersion(chatId, messageId);
	}

	async getForkMetadata(chatId: string, userId: string): Promise<ForkMetadata | null> {
		await this.assertOwner(chatId, userId);
		return this.chats.getForkMetadata(chatId);
	}

	async getContextUsage(
		chatId: string,
		userId: string,
		model?: { provider: string; modelId: string },
	): Promise<ContextUsage> {
		await this.assertOwner(chatId, userId);
		const usage = await this.agents.getChatContextUsage({
			chatId,
			model: model && { provider: model.provider as LlmProvider, modelId: model.modelId },
		});
		if (!usage) {
			throw new HandlerError('NOT_FOUND', `Chat with id ${chatId} not found.`);
		}
		return usage;
	}

	/** Upstream `ownedResourceProcedure(getChatOwnerId, 'chat')`. */
	async assertOwner(chatId: string, userId: string): Promise<void> {
		const ownerId = await this.chats.getChatOwnerId(chatId);
		if (!ownerId) {
			throw new HandlerError('NOT_FOUND', 'chat not found.');
		}
		if (ownerId !== userId) {
			throw new HandlerError('FORBIDDEN', 'You are not authorized to modify this chat.');
		}
	}
}

const delay = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
