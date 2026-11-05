import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { EncounterPrescriptionsLoader } from './prescription.loader.js';
import { PrescriptionRepository } from './prescription.repository.js';
import { PrescriptionService } from './prescription.service.js';
import {
	EncounterRecordPrescriptionsResolver,
	PatientVisitPrescriptionsResolver,
	PrescriptionsResolver,
} from './prescriptions.resolver.js';

/**
 * Prescriptions of an encounter (DESIGN.md §5; RA 6675, RA 9165): drafts, issuing (signed, locked), voiding, the print
 * view, and the prescriptions fields of the encounter record and the chart's visit list.
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		DocumentSequencesModule,
		EncountersModule,
		PatientsModule,
		PractitionersModule,
		WiseProposalsModule,
	],
	providers: [
		PrescriptionsResolver,
		EncounterRecordPrescriptionsResolver,
		PatientVisitPrescriptionsResolver,
		PrescriptionService,
		PrescriptionRepository,
		EncounterPrescriptionsLoader,
	],
	exports: [PrescriptionService],
})
export class PrescriptionsModule {}
