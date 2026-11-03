import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { SharedChat } from '../generated/prisma/client.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { ChatRepository } from './chat.repository.js';
import { ChatsService } from './chats.service.js';
import type { Chat } from './models/chat.model.js';
import { ProjectSharingService } from './project-sharing.service.js';
import { SharedChatRepository, type SharedChatWithDetails } from './shared-chat.repository.js';

/**
 * Port of upstream `trpc/shared-chat.routes.ts` (minus `downloadStory`, Phase 4). Activity logging and share
 * notifications come with their modules (Phase 5).
 */
@Injectable()
export class SharedChatsService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly sharedChats: SharedChatRepository,
		private readonly projects: ProjectRepository,
		private readonly sharing: ProjectSharingService,
		private readonly chatsService: ChatsService,
	) {}

	async list(userId: string): Promise<SharedChatWithDetails[]> {
		const projects = await this.projects.listUserProjectsWithRoles(userId);
		return this.sharedChats.listUserSharedChats(
			projects.map(({ project }) => project.id),
			userId,
		);
	}

	async create(
		ctx: { projectId: string; userId: string; userRole: UserRole },
		input: { chatId: string; visibility: 'project' | 'specific'; allowedUserIds?: string[] },
	): Promise<SharedChat> {
		const chatInfo = await this.chats.getChatInfo(input.chatId);
		if (!chatInfo || chatInfo.projectId !== ctx.projectId) {
			throw new HandlerError('NOT_FOUND', 'Chat not found.');
		}
		if (chatInfo.userId !== ctx.userId && ctx.userRole !== 'admin') {
			throw new HandlerError('FORBIDDEN', 'Only the creator or an admin can share this.');
		}
		if (input.visibility === 'project') {
			await this.sharing.assertCanShareToProject(ctx.projectId, ctx.userId);
		} else {
			await this.sharing.assertCanShareWith(ctx.projectId, ctx.userId, { userIds: input.allowedUserIds });
		}
		return this.sharedChats.createSharedChat(
			{ chatId: input.chatId, visibility: input.visibility },
			input.allowedUserIds,
		);
	}

	async getSharedChatDetails(shareId: string): Promise<SharedChatWithDetails> {
		const share = await this.sharedChats.getSharedChatInfo(shareId);
		if (!share) {
			throw new HandlerError('NOT_FOUND', 'Shared chat not found.');
		}
		return share;
	}

	/** Upstream `getSharedChat` (`shareAccessProcedure`): the share and its chat for a recipient. */
	async getSharedChat(
		shareId: string,
		userId: string,
	): Promise<{ share: SharedChatWithDetails; chat: Chat; userRole: UserRole | null }> {
		const { share, userRole } = await this.resolveShare(shareId, userId, true);
		const chat = await this.chatsService.getChatSummary(share.chatId).catch(() => {
			throw new HandlerError('NOT_FOUND', 'Chat not found.');
		});
		return { share, chat, userRole };
	}

	async getShareOptionsByChatId(
		chatId: string,
		userId: string,
	): Promise<{ shareId: string | null; visibility: string | null; allowedUserIds: string[] }> {
		const chatInfo = await this.chats.getChatInfo(chatId);
		if (!chatInfo) {
			throw new HandlerError('NOT_FOUND', 'Chat not found.');
		}
		await this.requireProjectRole(chatInfo.projectId, userId);

		const share = await this.sharedChats.getShareIdByChatId(chatId, userId);
		if (!share) {
			return { shareId: null, visibility: null, allowedUserIds: [] };
		}
		const allowedUserIds =
			share.visibility === 'specific' ? await this.sharedChats.getShareAllowedUserIds(share.id) : [];
		return { shareId: share.id, visibility: share.visibility, allowedUserIds };
	}

	/**
	 * Upstream `project.getProjectMembersByChatId`: who the chat can be shared with. Every member of the chat's project
	 * until user groups narrow share audiences (Phase 6, `ProjectSharingService`).
	 */
	async listShareableMembers(
		chatId: string,
		userId: string,
	): Promise<{ id: string; name: string; email: string; role: string }[]> {
		const projectId = await this.chats.getChatProjectId(chatId);
		if (!projectId) {
			return [];
		}
		await this.requireProjectRole(projectId, userId);
		return this.projects.listUsersWithProjectAccess(projectId);
	}

	async updateAccess(shareId: string, userId: string, allowedUserIds: string[]): Promise<void> {
		const { share, userRole } = await this.resolveShare(shareId, userId, false);
		const chatOwnerId = await this.chats.getChatOwnerId(share.chatId);
		if (!chatOwnerId || (chatOwnerId !== userId && userRole !== 'admin')) {
			throw new HandlerError('FORBIDDEN', 'Only the creator or an admin can update this.');
		}

		const previousAllowedUserIds = await this.sharedChats.getShareAllowedUserIds(shareId);
		await this.sharing.assertCanShareWith(share.projectId, userId, {
			userIds: allowedUserIds.filter((id) => !previousAllowedUserIds.includes(id)),
		});

		const accessibleUsers = await this.projects.listUsersWithProjectAccess(share.projectId);
		const accessibleUserIds = new Set(accessibleUsers.map((member) => member.id));
		const validUserIds = allowedUserIds.filter((id) => accessibleUserIds.has(id));
		if (allowedUserIds.length > 0 && validUserIds.length === 0) {
			throw new HandlerError('BAD_REQUEST', 'No valid users in the provided list.');
		}
		await this.sharedChats.updateSharedChatAllowedUsers(shareId, validUserIds);
	}

	async delete(shareId: string, userId: string): Promise<void> {
		const { share, userRole } = await this.resolveShare(shareId, userId, false);
		const chatOwnerId = await this.chats.getChatOwnerId(share.chatId);
		if (!chatOwnerId || (chatOwnerId !== userId && userRole !== 'admin')) {
			throw new HandlerError('FORBIDDEN', 'Only the creator or an admin can delete this.');
		}
		await this.sharedChats.deleteSharedChat(shareId);
	}

	/**
	 * Upstream `resolveSharedChat` (chat-fork routes): the share, when the user is in its project and, for a
	 * `specific` share, a recipient or the owner.
	 */
	async resolveSharedChatForFork(shareId: string, userId: string): Promise<SharedChatWithDetails> {
		const share = await this.sharedChats.getSharedChatInfo(shareId);
		if (!share) {
			throw new HandlerError('NOT_FOUND', 'Shared chat not found.');
		}
		const userRole = await this.projects.getUserRoleInProject(share.projectId, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this project.');
		}
		if (share.visibility === 'specific' && share.userId !== userId) {
			if (!(await this.sharedChats.canUserAccessSharedChat(share.id, userId))) {
				throw new HandlerError('FORBIDDEN', 'You do not have access to this chat.');
			}
		}
		return share;
	}

	/** Upstream `resourceProjectProcedure('shareId', getSharedChatInfo, 'Shared chat', checkAccess?)`. */
	private async resolveShare(
		shareId: string,
		userId: string,
		checkRecipientAccess: boolean,
	): Promise<{ share: SharedChatWithDetails; userRole: UserRole }> {
		const share = await this.sharedChats.getSharedChatInfo(shareId);
		if (!share) {
			throw new HandlerError('NOT_FOUND', 'Shared chat not found.');
		}
		const userRole = await this.requireProjectRole(share.projectId, userId);
		if (checkRecipientAccess && share.visibility === 'specific') {
			const isOwner = (await this.chats.getChatOwnerId(share.chatId)) === userId;
			if (!isOwner && !(await this.sharedChats.canUserAccessSharedChat(share.id, userId))) {
				throw new HandlerError('FORBIDDEN', 'You do not have access to this shared chat.');
			}
		}
		return { share, userRole };
	}

	private async requireProjectRole(projectId: string, userId: string): Promise<UserRole> {
		const userRole = await this.projects.getUserRoleInProject(projectId, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this project.');
		}
		return userRole;
	}
}
