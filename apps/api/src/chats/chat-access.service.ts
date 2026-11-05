import { Injectable } from '@nestjs/common';

import { ClinicRepository } from '../clinics/clinic.repository.js';
import { ChatRepository } from './chat.repository.js';

/** Port of upstream `utils/chat-access.ts`. */
@Injectable()
export class ChatAccessService {
	constructor(
		private readonly chats: ChatRepository,
		private readonly clinics: ClinicRepository,
	) {}

	/** Whoever can open the chat (owner or share recipient) can view its content, and so can the clinic admins who replay it. */
	async canUserViewChatContent(chatId: string, chatClinicId: string, userId: string): Promise<boolean> {
		if (await this.chats.canUserAccessChat(chatId, userId)) {
			return true;
		}
		const role = await this.clinics.getUserRoleInClinic(chatClinicId, userId);
		return role === 'admin' || role === 'context_admin';
	}
}
