import { Module } from '@nestjs/common';

import { AgentCoreModule } from '../agent/agent-core.module.js';
import { UsersCoreModule } from '../users/users-core.module.js';
import { UsageRepository } from './usage.repository.js';
import { UsageResolver } from './usage.resolver.js';
import { UsageService } from './usage.service.js';
import { UsagePeriodSettingsService } from './usage-period-settings.service.js';

/** Usage and costs (upstream `usage`): the Settings → Usage API over chat messages and `llm_inference` records. */
@Module({
	imports: [AgentCoreModule, UsersCoreModule],
	providers: [UsageRepository, UsagePeriodSettingsService, UsageService, UsageResolver],
})
export class UsageModule {}
