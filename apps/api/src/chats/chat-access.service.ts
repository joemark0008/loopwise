import { Injectable } from '@nestjs/common';

import { ProjectRepository } from '../projects/project.repository.js';
import { ChatRepository } from './chat.repository.js';

/** Port of upstream `utils/chat-access.ts`. */
@Injectable()
export class ChatAccessService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly projects: ProjectRepository,
	) {}

	/** Whoever can open the chat (owner or share recipient) can view its content, and so can the project admins who replay it. */
	async canUserViewChatContent(chatId: string, chatProjectId: string, userId: string): Promise<boolean> {
		if (await this.chats.canUserAccessChat(chatId, userId)) {
			return true;
		}
		const role = await this.projects.getUserRoleInProject(chatProjectId, userId);
		return role === 'admin' || role === 'context_admin';
	}
}
