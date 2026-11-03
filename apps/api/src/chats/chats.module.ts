import { Module } from '@nestjs/common';

import { AgentModule } from '../agent/agent.module.js';
import { ProjectsCoreModule } from '../projects/projects-core.module.js';
import { UsersModule } from '../users/users.module.js';
import { ChatMessagesLoader } from './chat.loader.js';
import { ChatForkService } from './chat-fork.service.js';
import { ChatsResolver } from './chats.resolver.js';
import { ChatsService } from './chats.service.js';
import { ChatsCoreModule } from './chats-core.module.js';
import { CitationService } from './citation.service.js';
import { FeedbackRepository } from './feedback.repository.js';
import { FeedbackService } from './feedback.service.js';
import { ProjectSharingService } from './project-sharing.service.js';
import { QueryRowsService } from './query-rows.service.js';
import { SharedChatRepository } from './shared-chat.repository.js';
import { SharedChatsResolver } from './shared-chats.resolver.js';
import { SharedChatsService } from './shared-chats.service.js';

/**
 * Chats, messages, shares, forks, citations, feedback, query rows and SQL edits over GraphQL (PLAN.md §6 `chats`).
 * SQL edits and query rows read the `execute_sql` parts stored in chats, so they live here rather than in
 * `warehouse` (which the agent module imports).
 */
@Module({
	imports: [ChatsCoreModule, AgentModule, ProjectsCoreModule, UsersModule],
	providers: [
		ChatsService,
		ChatsResolver,
		ChatMessagesLoader,
		SharedChatRepository,
		SharedChatsService,
		SharedChatsResolver,
		ProjectSharingService,
		ChatForkService,
		FeedbackRepository,
		FeedbackService,
		CitationService,
		QueryRowsService,
	],
})
export class ChatsModule {}
