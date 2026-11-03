import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { CliniciansModule } from '../clinicians/clinicians.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { MedicalCertificateRepository } from './medical-certificate.repository.js';
import { MedicalCertificateService } from './medical-certificate.service.js';
import { MedicalCertificatesResolver } from './medical-certificates.resolver.js';

/** Medical certificates of an encounter (DESIGN.md §7): drafts, issuing (locked) and voiding, and the print view. */
@Module({
	imports: [
		ClinicalDbModule,
		ClinicalAuditModule,
		OrganizationsModule,
		EncountersModule,
		CliniciansModule,
		WiseProposalsModule,
	],
	providers: [MedicalCertificatesResolver, MedicalCertificateService, MedicalCertificateRepository],
})
export class MedicalCertificatesModule {}
