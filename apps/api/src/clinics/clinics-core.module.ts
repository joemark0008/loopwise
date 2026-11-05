import { Module } from '@nestjs/common';

import { GuardsModule } from '../common/guards/guards.module.js';
import { ClinicRepository } from './clinic.repository.js';

/**
 * Clinic lookup and staff roles, for the modules the full `ClinicsModule` depends on (organizations, chats, charts …);
 * re-exports `AccessService` (who may open which clinic, with which roles).
 */
@Module({
	imports: [GuardsModule],
	providers: [ClinicRepository],
	exports: [ClinicRepository, GuardsModule],
})
export class ClinicsCoreModule {}
