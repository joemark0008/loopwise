import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { ClinicDirectoryService } from '../clinical/clinics/clinics/clinic-directory.service.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { AccessService } from '../common/guards/access.service.js';
import type { SharedChat } from '../generated/prisma/client.js';
import { ChatRepository } from './chat.repository.js';
import { ChatsService } from './chats.service.js';
import { ClinicSharingService } from './clinic-sharing.service.js';
import type { Chat } from './models/chat.model.js';
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
		private readonly clinics: ClinicDirectoryService,
		private readonly access: AccessService,
		private readonly sharing: ClinicSharingService,
		private readonly chatsService: ChatsService,
	) {}

	async list(userId: string): Promise<SharedChatWithDetails[]> {
		const clinics = await this.access.listUserClinics(userId);
		return this.sharedChats.listUserSharedChats(
			clinics.map(({ clinic }) => clinic.id),
			userId,
		);
	}

	async create(
		ctx: { clinicId: string; userId: string; userRole: UserRole },
		input: { chatId: string; visibility: 'clinic' | 'specific'; allowedUserIds?: string[] },
	): Promise<SharedChat> {
		const chatInfo = await this.chats.getChatInfo(input.chatId);
		if (!chatInfo || chatInfo.clinicId !== ctx.clinicId) {
			throw new HandlerError('NOT_FOUND', 'Chat not found.');
		}
		if (chatInfo.userId !== ctx.userId && ctx.userRole !== 'admin') {
			throw new HandlerError('FORBIDDEN', 'Only the creator or an admin can share this.');
		}
		if (input.visibility === 'clinic') {
			await this.sharing.assertCanShareToClinic(ctx.clinicId, ctx.userId);
		} else {
			await this.sharing.assertCanShareWith(ctx.clinicId, ctx.userId, { userIds: input.allowedUserIds });
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
		await this.requireClinicRole(chatInfo.clinicId, userId);

		const share = await this.sharedChats.getShareIdByChatId(chatId, userId);
		if (!share) {
			return { shareId: null, visibility: null, allowedUserIds: [] };
		}
		const allowedUserIds =
			share.visibility === 'specific' ? await this.sharedChats.getShareAllowedUserIds(share.id) : [];
		return { shareId: share.id, visibility: share.visibility, allowedUserIds };
	}

	/**
	 * Upstream `clinic.getClinicMembersByChatId`: who the chat can be shared with. Every member of the chat's clinic
	 * until user groups narrow share audiences (Phase 6, `ClinicSharingService`).
	 */
	async listShareableMembers(
		chatId: string,
		userId: string,
	): Promise<{ id: string; name: string; email: string; role: string }[]> {
		const clinicId = await this.chats.getChatClinicId(chatId);
		if (!clinicId) {
			return [];
		}
		await this.requireClinicRole(clinicId, userId);
		return this.clinics.listUsersWithClinicAccess(clinicId);
	}

	async updateAccess(shareId: string, userId: string, allowedUserIds: string[]): Promise<void> {
		const { share, userRole } = await this.resolveShare(shareId, userId, false);
		const chatOwnerId = await this.chats.getChatOwnerId(share.chatId);
		if (!chatOwnerId || (chatOwnerId !== userId && userRole !== 'admin')) {
			throw new HandlerError('FORBIDDEN', 'Only the creator or an admin can update this.');
		}

		const previousAllowedUserIds = await this.sharedChats.getShareAllowedUserIds(shareId);
		await this.sharing.assertCanShareWith(share.clinicId, userId, {
			userIds: allowedUserIds.filter((id) => !previousAllowedUserIds.includes(id)),
		});

		const accessibleUsers = await this.clinics.listUsersWithClinicAccess(share.clinicId);
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
	 * Upstream `resolveSharedChat` (chat-fork routes): the share, when the user is in its clinic and, for a
	 * `specific` share, a recipient or the owner.
	 */
	async resolveSharedChatForFork(shareId: string, userId: string): Promise<SharedChatWithDetails> {
		const share = await this.sharedChats.getSharedChatInfo(shareId);
		if (!share) {
			throw new HandlerError('NOT_FOUND', 'Shared chat not found.');
		}
		const userRole = await this.access.getUserRoleInClinic(share.clinicId, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this clinic.');
		}
		if (share.visibility === 'specific' && share.userId !== userId) {
			if (!(await this.sharedChats.canUserAccessSharedChat(share.id, userId))) {
				throw new HandlerError('FORBIDDEN', 'You do not have access to this chat.');
			}
		}
		return share;
	}

	/** Upstream `resourceClinicProcedure('shareId', getSharedChatInfo, 'Shared chat', checkAccess?)`. */
	private async resolveShare(
		shareId: string,
		userId: string,
		checkRecipientAccess: boolean,
	): Promise<{ share: SharedChatWithDetails; userRole: UserRole }> {
		const share = await this.sharedChats.getSharedChatInfo(shareId);
		if (!share) {
			throw new HandlerError('NOT_FOUND', 'Shared chat not found.');
		}
		const userRole = await this.requireClinicRole(share.clinicId, userId);
		if (checkRecipientAccess && share.visibility === 'specific') {
			const isOwner = (await this.chats.getChatOwnerId(share.chatId)) === userId;
			if (!isOwner && !(await this.sharedChats.canUserAccessSharedChat(share.id, userId))) {
				throw new HandlerError('FORBIDDEN', 'You do not have access to this shared chat.');
			}
		}
		return { share, userRole };
	}

	private async requireClinicRole(clinicId: string, userId: string): Promise<UserRole> {
		const userRole = await this.access.getUserRoleInClinic(clinicId, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this clinic.');
		}
		return userRole;
	}
}
