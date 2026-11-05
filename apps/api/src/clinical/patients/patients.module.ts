import { Module } from '@nestjs/common';

import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { FacilityLoader } from './patient.loader.js';
import { PatientRepository } from './patient.repository.js';
import { PatientService } from './patient.service.js';
import { PATIENT_READER } from './patient-reader.token.js';
import { PatientIdentifierResolver, PatientsResolver } from './patients.resolver.js';

/** Patient registration and lookup (DESIGN.md §5, §8): the first clinical feature module. */
@Module({
	imports: [ClinicalDbModule, OrganizationsModule, ChatsCoreModule, WiseProposalsModule],
	providers: [
		PatientsResolver,
		PatientIdentifierResolver,
		PatientService,
		PatientRepository,
		FacilityLoader,
		{ provide: PATIENT_READER, useExisting: PatientService },
	],
	exports: [PatientService, PATIENT_READER],
})
export class PatientsModule {}
