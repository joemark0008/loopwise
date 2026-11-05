import { Module } from '@nestjs/common';

import { ClinicsCoreModule } from '../clinics/clinics-core.module.js';
import { ChatRepository } from './chat.repository.js';
import { ChatAccessService } from './chat-access.service.js';

/** Chat persistence, shared by the agent (which writes messages) and the chats API, and the chat-view access check. */
@Module({
	imports: [ClinicsCoreModule],
	providers: [ChatRepository, ChatAccessService],
	exports: [ChatRepository, ChatAccessService],
})
export class ChatsCoreModule {}
