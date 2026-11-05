import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { WiseToolSettingsRepository } from './wise-tool-settings.repository.js';
import { WiseToolSettingsService } from './wise-tool-settings.service.js';
import { WiseToolsResolver } from './wise-tools.resolver.js';

/** Wise tool settings (DESIGN.md §7.3); the agent and the Wise card checks use the service. */
@Module({
	imports: [OrganizationsModule],
	providers: [WiseToolsResolver, WiseToolSettingsService, WiseToolSettingsRepository],
	exports: [WiseToolSettingsService],
})
export class WiseToolsModule {}
