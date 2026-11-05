import { Module } from '@nestjs/common';

import { UsageCoreModule } from '../usage/usage-core.module.js';
import { ClinicLlmConfigRepository } from './llm/clinic-llm-config.repository.js';
import { LlmService } from './llm/llm.service.js';

/**
 * Model resolution and inference recording, shared by the agent and the modules it calls back into (memory,
 * onboarding, recommendations).
 */
@Module({
	imports: [UsageCoreModule],
	providers: [LlmService, ClinicLlmConfigRepository],
	exports: [LlmService, ClinicLlmConfigRepository, UsageCoreModule],
})
export class AgentCoreModule {}
