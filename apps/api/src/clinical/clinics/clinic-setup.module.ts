import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ReferenceModule } from '../reference/reference.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { DocumentSequencesModule } from './document-sequences/document-sequences.module.js';
import { CredentialExpiryResolver } from './expiries/credential-expiry.resolver.js';
import { CredentialExpiryService } from './expiries/credential-expiry.service.js';
import { ClinicProfileRepository } from './profile/clinic-profile.repository.js';
import { ClinicProfileResolver } from './profile/clinic-profile.resolver.js';
import { ClinicProfileService } from './profile/clinic-profile.service.js';

/**
 * Clinic setup (Settings → Clinic, admins): the organization's and the clinic's profile (BIR, DOH, PhilHealth, PSGC
 * address), document numbering, and the licenses expiring soon. Practitioners' schedules and the price list have their
 * own modules (`practitioners`, `billing`).
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		GuardsModule,
		ReferenceModule,
		PractitionersModule,
		DocumentSequencesModule,
	],
	providers: [
		ClinicProfileRepository,
		ClinicProfileService,
		ClinicProfileResolver,
		CredentialExpiryService,
		CredentialExpiryResolver,
	],
})
export class ClinicSetupModule {}
