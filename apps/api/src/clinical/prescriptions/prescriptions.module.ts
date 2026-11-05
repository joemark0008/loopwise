import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { CliniciansModule } from '../clinicians/clinicians.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { PrescriptionRepository } from './prescription.repository.js';
import { PrescriptionService } from './prescription.service.js';
import { PrescriptionsResolver } from './prescriptions.resolver.js';

/** Prescriptions of an encounter (DESIGN.md §5): drafts, issuing (locked) and voiding, and the print view. */
@Module({
	imports: [
		ClinicalDbModule,
		ClinicalAuditModule,
		OrganizationsModule,
		EncountersModule,
		CliniciansModule,
		WiseProposalsModule,
	],
	providers: [PrescriptionsResolver, PrescriptionService, PrescriptionRepository],
})
export class PrescriptionsModule {}
