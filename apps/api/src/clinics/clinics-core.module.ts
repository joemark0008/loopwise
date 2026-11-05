import { Module } from '@nestjs/common';

import { ClinicRepository } from './clinic.repository.js';

/** Clinic lookup and membership, for the modules the full `ClinicsModule` depends on (guards, organizations). */
@Module({
	providers: [ClinicRepository],
	exports: [ClinicRepository],
})
export class ClinicsCoreModule {}
