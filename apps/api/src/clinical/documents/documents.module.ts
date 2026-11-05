import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { MedicalCertificateRepository } from './medical-certificates/medical-certificate.repository.js';
import { MedicalCertificateService } from './medical-certificates/medical-certificate.service.js';
import {
	EncounterCertificatesLoader,
	EncounterRecordCertificatesResolver,
	MedicalCertificatesResolver,
} from './medical-certificates/medical-certificates.resolver.js';
import { ReferralRepository } from './referrals/referral.repository.js';
import { ReferralService } from './referrals/referral.service.js';
import {
	EncounterRecordReferralsResolver,
	EncounterReferralsLoader,
	ReferralsResolver,
} from './referrals/referrals.resolver.js';

/**
 * The clinical documents of an encounter (DESIGN.md §5): medical certificates (draft, issue, void, print) and
 * referrals (internal or outside), and their fields on the encounter record. Prescriptions have their own module.
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		DocumentSequencesModule,
		EncountersModule,
		PractitionersModule,
		WiseProposalsModule,
	],
	providers: [
		MedicalCertificatesResolver,
		EncounterRecordCertificatesResolver,
		MedicalCertificateService,
		MedicalCertificateRepository,
		EncounterCertificatesLoader,
		ReferralsResolver,
		EncounterRecordReferralsResolver,
		ReferralService,
		ReferralRepository,
		EncounterReferralsLoader,
	],
	exports: [MedicalCertificateService, ReferralService],
})
export class DocumentsModule {}
