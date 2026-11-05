import { Module } from '@nestjs/common';

import { ClinicRepository } from './clinic.repository.js';
import { ClinicSavedPromptRepository } from './clinic-saved-prompt.repository.js';
import { ClinicsResolver } from './clinics.resolver.js';
import { ClinicsService } from './clinics.service.js';
import { ClinicsCoreModule } from './clinics-core.module.js';

/** Clinics as Wise workspaces: list, current, create, rename, delete, saved prompts, display settings. */
@Module({
	imports: [ClinicsCoreModule],
	providers: [ClinicRepository, ClinicSavedPromptRepository, ClinicsService, ClinicsResolver],
	exports: [ClinicsCoreModule, ClinicsService],
})
export class ClinicsModule {}
