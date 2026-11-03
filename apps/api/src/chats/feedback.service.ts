import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { MessageFeedback } from '../generated/prisma/client.js';
import { ChatRepository } from './chat.repository.js';
import { FeedbackRepository, type FeedbackWithDetails } from './feedback.repository.js';

/**
 * Port of the message half of upstream `trpc/feedback.routes.ts` (`submit`, `getRecent`). Story feedback comes
 * with stories (Phase 4) and the data-team notification with notifications (Phase 5).
 */
@Injectable()
export class FeedbackService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly feedbacks: FeedbackRepository,
	) {}

	async submit(
		userId: string,
		input: { chatId: string; messageId: string; vote: 'up' | 'down'; explanation?: string },
	): Promise<MessageFeedback> {
		const ownerId = await this.chats.getOwnerOfChatAndMessage(input.chatId, input.messageId);
		if (!ownerId) {
			throw new HandlerError('NOT_FOUND', `Message with id ${input.messageId} not found.`);
		}
		if (ownerId !== userId) {
			throw new HandlerError('FORBIDDEN', 'You are not authorized to provide feedback on this message.');
		}
		return this.feedbacks.upsertFeedback({
			messageId: input.messageId,
			vote: input.vote,
			explanation: input.explanation,
		});
	}

	listRecent(projectId: string, limit = 10): Promise<FeedbackWithDetails[]> {
		return this.feedbacks.listRecentFeedbacks(projectId, limit);
	}
}
