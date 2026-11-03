import { Module } from '@nestjs/common';

import { UsageCoreModule } from '../usage/usage-core.module.js';
import { LlmService } from './llm/llm.service.js';
import { ProjectLlmConfigRepository } from './llm/project-llm-config.repository.js';

/**
 * Model resolution and inference recording, shared by the agent and the modules it calls back into (memory,
 * onboarding, recommendations).
 */
@Module({
	imports: [UsageCoreModule],
	providers: [LlmService, ProjectLlmConfigRepository],
	exports: [LlmService, ProjectLlmConfigRepository, UsageCoreModule],
})
export class AgentCoreModule {}
