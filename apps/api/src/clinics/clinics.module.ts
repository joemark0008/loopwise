import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ClinicSavedPromptRepository } from './clinic-saved-prompt.repository.js';
import { ClinicsResolver } from './clinics.resolver.js';
import { ClinicsService } from './clinics.service.js';
import { ClinicsCoreModule } from './clinics-core.module.js';

/** Port of upstream trpc `clinic` (core: list, current, create, rename, delete, saved prompts). */
@Module({
	imports: [ClinicsCoreModule, OrganizationsModule],
	providers: [ClinicSavedPromptRepository, ClinicsService, ClinicsResolver],
	exports: [ClinicsCoreModule, ClinicsService],
})
export class ClinicsModule {}
