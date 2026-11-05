import { Module } from '@nestjs/common';

import { AuditModule } from '../clinical/audit/audit.module.js';
import { OrganizationsModule } from '../clinical/clinics/organizations/organizations.module.js';
import { ClinicalDbModule } from '../clinical/rls/clinical-db.module.js';
import { WiseToolSettingsRepository } from './wise-tool-settings.repository.js';
import { WiseToolSettingsService } from './wise-tool-settings.service.js';
import { WiseToolsResolver } from './wise-tools.resolver.js';

/** Wise tool settings (DESIGN.md §7.3); the agent and the Wise card checks use the service. */
@Module({
	imports: [OrganizationsModule, ClinicalDbModule, AuditModule],
	providers: [WiseToolsResolver, WiseToolSettingsService, WiseToolSettingsRepository],
	exports: [WiseToolSettingsService],
})
export class WiseToolsModule {}
