import { Module } from '@nestjs/common';

import { LlmInferenceRepository } from './llm-inference.repository.js';
import { LlmInferenceService } from './llm-inference.service.js';

/** Records `llm_inference` rows; shared by the agent and the modules that call a model outside a chat run. */
@Module({
	providers: [LlmInferenceRepository, LlmInferenceService],
	exports: [LlmInferenceService],
})
export class UsageCoreModule {}
