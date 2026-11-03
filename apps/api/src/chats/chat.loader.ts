import { Injectable } from '@nestjs/common';

import type { UIMessage } from '../agent/types/chat.js';
import { LoaderFactory } from '../common/dataloader/loader-factory.js';
import { ChatsService } from './chats.service.js';

/** Active messages by chat id, batched per request (`Chat.messages`). */
@Injectable()
export class ChatMessagesLoader extends LoaderFactory<string, UIMessage[]> {
	constructor(private readonly chats: ChatsService) {
		super();
	}

	batch(chatIds: readonly string[]) {
		return this.chats.getMessagesByChatIds(chatIds);
	}
}
