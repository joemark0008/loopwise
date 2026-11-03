import { Module } from '@nestjs/common';

import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { ClinicianRepository } from './clinician.repository.js';
import { ClinicianService } from './clinician.service.js';
import { CliniciansResolver } from './clinicians.resolver.js';

/** Clinician profiles: what prescriptions and medical certificates print about who signs them. */
@Module({
	imports: [ClinicalDbModule],
	providers: [CliniciansResolver, ClinicianService, ClinicianRepository],
	exports: [ClinicianRepository],
})
export class CliniciansModule {}
