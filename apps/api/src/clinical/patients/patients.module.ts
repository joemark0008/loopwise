import { Module } from '@nestjs/common';

import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { ReferenceModule } from '../reference/reference.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { CareClinicService } from './care-clinic.service.js';
import { ClinicRefLoader } from './patient.loader.js';
import { PatientRepository } from './patient.repository.js';
import { PatientService } from './patient.service.js';
import { PatientAllergyRepository } from './patient-allergy.repository.js';
import { PatientAllergyService } from './patient-allergy.service.js';
import { PatientChartRepository } from './patient-chart.repository.js';
import { PATIENT_READER } from './patient-reader.token.js';
import { PatientRegistrationService } from './patient-registration.service.js';
import { PatientWiseReader } from './patient-wise-reader.js';
import { PatientAllergiesResolver, PatientsResolver } from './patients.resolver.js';

/**
 * Patients of an organization (DESIGN.md §5, §8): registration with duplicate checks and consent, lookup, contact
 * details, IDs, addresses and allergies; and the clinics where the user does clinical work (`CareClinicService`).
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		GuardsModule,
		DocumentSequencesModule,
		ReferenceModule,
		ChatsCoreModule,
		WiseProposalsModule,
	],
	providers: [
		PatientsResolver,
		PatientAllergiesResolver,
		PatientService,
		PatientRegistrationService,
		PatientAllergyService,
		CareClinicService,
		PatientRepository,
		PatientChartRepository,
		PatientAllergyRepository,
		ClinicRefLoader,
		PatientWiseReader,
		{ provide: PATIENT_READER, useExisting: PatientWiseReader },
	],
	exports: [PatientService, PatientRegistrationService, PatientAllergyService, CareClinicService, PATIENT_READER],
})
export class PatientsModule {}
