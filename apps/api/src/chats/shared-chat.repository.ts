import type { MessageBubble } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import type { ForkMetadata } from '../agent/types/chat.js';
import type { SharedChat } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type SharedChatWithDetails = SharedChat & {
	authorName: string;
	title: string;
	userId: string;
	projectId: string;
	forkMetadata?: ForkMetadata;
	messageBubbles?: MessageBubble[];
};

/** Port of upstream `queries/shared-chat.queries.ts`. */
@Injectable()
export class SharedChatRepository {
	constructor(private readonly prisma: PrismaService) {}

	async listUserSharedChats(projectIds: string[], userId: string): Promise<SharedChatWithDetails[]> {
		if (projectIds.length === 0) {
			return [];
		}
		const chats = await this.prisma.$queryRaw<SharedChatWithDetails[]>`
			SELECT s.id, c.project_id AS "projectId", c.user_id AS "userId", s.chat_id AS "chatId", s.visibility,
				s.created_at AS "createdAt", u.name AS "authorName", c.title
			FROM shared_chat s
			JOIN chat c ON c.id = s.chat_id
			JOIN "user" u ON u.id = c.user_id
			LEFT JOIN shared_chat_access a ON a.shared_chat_id = s.id AND a.user_id = ${userId}
			WHERE c.project_id = ANY(${projectIds}::text[])
				AND (s.visibility = 'project' OR c.user_id = ${userId} OR a.user_id IS NOT NULL)
			ORDER BY s.created_at DESC`;
		const bubblesMap = await this.fetchMessageBubbles(chats.map((chat) => chat.chatId));
		return chats.map((chat) => ({ ...chat, messageBubbles: bubblesMap.get(chat.chatId) }));
	}

	async createSharedChat(
		chat: Pick<SharedChat, 'chatId' | 'visibility'>,
		allowedUserIds?: string[],
	): Promise<SharedChat> {
		return this.prisma.$transaction(async (tx) => {
			const created = await tx.sharedChat.create({ data: chat });
			if (chat.visibility === 'specific' && allowedUserIds && allowedUserIds.length > 0) {
				await tx.sharedChatAccess.createMany({
					data: allowedUserIds.map((userId) => ({ sharedChatId: created.id, userId })),
				});
			}
			return created;
		});
	}

	async canUserAccessSharedChat(shareId: string, userId: string): Promise<boolean> {
		const row = await this.prisma.sharedChatAccess.findUnique({
			where: { sharedChatId_userId: { sharedChatId: shareId, userId } },
			select: { sharedChatId: true },
		});
		return Boolean(row);
	}

	async getSharedChatInfo(id: string): Promise<SharedChatWithDetails | null> {
		const share = await this.prisma.sharedChat.findUnique({
			where: { id },
			include: {
				chat: { select: { projectId: true, userId: true, title: true, forkMetadata: true, user: true } },
			},
		});
		if (!share) {
			return null;
		}
		const { chat, ...row } = share;
		return {
			...row,
			projectId: chat.projectId,
			userId: chat.userId,
			authorName: chat.user.name,
			title: chat.title,
			forkMetadata: (chat.forkMetadata as ForkMetadata | null) ?? undefined,
		};
	}

	getShareIdByChatId(chatId: string, userId: string): Promise<{ id: string; visibility: string } | null> {
		return this.prisma.sharedChat.findFirst({
			where: { chatId, chat: { userId } },
			orderBy: { createdAt: 'desc' },
			select: { id: true, visibility: true },
		});
	}

	async getShareAllowedUserIds(shareId: string): Promise<string[]> {
		const rows = await this.prisma.sharedChatAccess.findMany({
			where: { sharedChatId: shareId },
			select: { userId: true },
		});
		return rows.map((row) => row.userId);
	}

	async updateSharedChatAllowedUsers(shareId: string, userIds: string[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.sharedChatAccess.deleteMany({ where: { sharedChatId: shareId } });
			if (userIds.length > 0) {
				await tx.sharedChatAccess.createMany({
					data: userIds.map((userId) => ({ sharedChatId: shareId, userId })),
				});
			}
		});
	}

	async deleteSharedChat(id: string): Promise<void> {
		await this.prisma.sharedChat.delete({ where: { id } });
	}

	private async fetchMessageBubbles(chatIds: string[]): Promise<Map<string, MessageBubble[]>> {
		if (chatIds.length === 0) {
			return new Map();
		}
		const rows = await this.prisma.$queryRaw<{ chatId: string; role: 'user' | 'assistant'; charCount: number }[]>`
			SELECT m.chat_id AS "chatId", m.role, coalesce(sum(length(mp.text)), 0)::int AS "charCount"
			FROM chat_message m
			LEFT JOIN message_part mp ON mp.message_id = m.id AND mp.type = 'text'
			WHERE m.chat_id = ANY(${chatIds}::text[]) AND m.superseded_at IS NULL AND m.role IN ('user', 'assistant')
			GROUP BY m.id, m.chat_id, m.role, m.created_at
			ORDER BY m.created_at ASC`;
		const map = new Map<string, MessageBubble[]>();
		for (const row of rows) {
			map.set(row.chatId, [...(map.get(row.chatId) ?? []), { role: row.role, charCount: Number(row.charCount) }]);
		}
		return map;
	}
}
