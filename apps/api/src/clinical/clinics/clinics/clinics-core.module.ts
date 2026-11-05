import { Module } from '@nestjs/common';

import { GuardsModule } from '../../../common/guards/guards.module.js';
import { ClinicRepository } from './clinic.repository.js';
import { ClinicDirectoryService } from './clinic-directory.service.js';

/**
 * Clinic lookup and the clinic's Wise workspace settings (`ClinicDirectoryService`), for the modules the full
 * `ClinicsModule` depends on (organizations, chats, charts …); re-exports `AccessService` (who may open which clinic,
 * with which roles). The repository stays inside the clinics domain.
 */
@Module({
	imports: [GuardsModule],
	providers: [ClinicRepository, ClinicDirectoryService],
	exports: [ClinicDirectoryService, GuardsModule],
})
export class ClinicsCoreModule {}
