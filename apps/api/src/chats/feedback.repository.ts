import { Injectable } from '@nestjs/common';

import type { MessageFeedback } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Port of upstream `queries/feedback.queries.ts` (message feedback). */
@Injectable()
export class FeedbackRepository {
	constructor(private readonly prisma: PrismaService) {}

	upsertFeedback(feedback: {
		messageId: string;
		vote: string;
		explanation?: string | null;
	}): Promise<MessageFeedback> {
		return this.prisma.messageFeedback.upsert({
			where: { messageId: feedback.messageId },
			create: feedback,
			update: { vote: feedback.vote, explanation: feedback.explanation },
		});
	}
}
