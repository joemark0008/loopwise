import { Module } from '@nestjs/common';

import { AgentModule } from '../agent/agent.module.js';
import { ModelSettingsResolver } from './model-settings.resolver.js';
import { ModelSettingsService } from './model-settings.service.js';

/** Clinic LLM providers, default models and agent settings (Settings → Models, Settings → Agent). */
@Module({
	imports: [AgentModule],
	providers: [ModelSettingsService, ModelSettingsResolver],
})
export class ModelSettingsModule {}
