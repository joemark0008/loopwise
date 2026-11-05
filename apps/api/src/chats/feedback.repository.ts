import { Injectable } from '@nestjs/common';

import type { MessageFeedback } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface FeedbackWithDetails {
	messageId: string;
	vote: string;
	explanation: string | null;
	createdAt: Date;
	userName: string;
	messageText: string | null;
}

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

	listRecentFeedbacks(clinicId: string, limit = 10): Promise<FeedbackWithDetails[]> {
		return this.prisma.$queryRaw<FeedbackWithDetails[]>`
			SELECT f.message_id AS "messageId", f.vote, f.explanation, f.created_at AS "createdAt", u.name AS "userName",
				t.aggregated_text AS "messageText"
			FROM message_feedback f
			JOIN chat_message m ON m.id = f.message_id
			JOIN chat c ON c.id = m.chat_id
			JOIN "user" u ON u.id = c.user_id
			LEFT JOIN (
				SELECT message_id, string_agg(text, ' ' ORDER BY "order") AS aggregated_text
				FROM message_part WHERE type = 'text' GROUP BY message_id
			) t ON t.message_id = f.message_id
			WHERE c.project_id = ${clinicId}
			ORDER BY f.created_at DESC
			LIMIT ${limit}`;
	}
}
