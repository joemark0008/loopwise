import { Injectable } from '@nestjs/common';

import { CompactionService } from '../agent/services/compaction.js';
import type { ForkMetadata, UIMessage } from '../agent/types/chat.js';
import { ChatRepository } from './chat.repository.js';
import type { SharedChatWithDetails } from './shared-chat.repository.js';
import { SharedChatsService } from './shared-chats.service.js';

export interface SelectionInfo {
	start: number;
	end: number;
	text: string;
}

type SharedChatForkKind = 'fork' | 'question';

/**
 * Port of the shared-chat half of upstream `trpc/chat-fork.routes.ts`: `fork` (of a chat), `askSharedChat` and
 * `listSharedChatQuickQuestions`. Story forks (`askStory`, `forkStory`, `openStandalone`, `fork` of a story)
 * come with stories (Phase 4).
 */
@Injectable()
export class ChatForkService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly sharedChats: SharedChatsService,
		private readonly compaction: CompactionService,
	) {}

	async forkSharedChat(
		shareId: string,
		userId: string,
		selection: SelectionInfo | undefined,
		kind: SharedChatForkKind,
	): Promise<{ chatId: string }> {
		const share = await this.sharedChats.resolveSharedChatForFork(shareId, userId);
		const forkMetadata = buildSharedChatForkMetadata(share, selection, kind);

		const rawMessages = await this.chats.getChatMessages(share.chatId);
		const seededMessages = this.compaction.useLastCompaction(rawMessages);
		const messages = selection
			? [...seededMessages, buildSelectionContextMessage(share.title, selection)]
			: seededMessages;

		const savedChat = await this.chats.createForkedChat(
			{ clinicId: share.clinicId, userId, title: share.title, forkMetadata },
			messages,
		);
		return { chatId: savedChat.id };
	}

	async listSharedChatQuickQuestions(shareId: string, userId: string) {
		const share = await this.sharedChats.resolveSharedChatForFork(shareId, userId);
		return this.chats.listQuickQuestionChats(userId, share.id);
	}
}

/** A question is tied to the share, like a selection, so it is listed on the shared chat's page. */
function buildSharedChatForkMetadata(
	share: SharedChatWithDetails,
	selection: SelectionInfo | undefined,
	kind: SharedChatForkKind,
): ForkMetadata {
	if (kind === 'question') {
		return selection
			? buildSelectionMetadata('chat_question', share.id, share.title, share.authorName, selection)
			: { type: 'chat_question', id: share.id, title: share.title, authorName: share.authorName };
	}
	return selection
		? buildSelectionMetadata('chat_selection', share.id, share.title, share.authorName, selection)
		: { type: 'chat', id: share.chatId, title: share.title, authorName: share.authorName };
}

function buildSelectionMetadata(
	type: 'chat_selection' | 'chat_question' | 'story_selection',
	sourceId: string,
	title: string,
	authorName: string,
	selection: SelectionInfo,
): ForkMetadata {
	return {
		type,
		id: sourceId,
		title,
		authorName,
		selectionStart: selection.start,
		selectionEnd: selection.end,
		selectionText: selection.text,
	};
}

function buildSelectionContextMessage(sourceTitle: string, selection: SelectionInfo): Omit<UIMessage, 'id'> {
	return {
		role: 'assistant',
		parts: [
			{
				type: 'text',
				text: `**From "${sourceTitle}"** — @chars ${selection.start}–${selection.end}:\n\n> ${selection.text}`,
			},
		],
	};
}
