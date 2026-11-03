import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { BillingRepository } from './billing.repository.js';
import { BillingResolver } from './billing.resolver.js';
import { BillingService } from './billing.service.js';

/** The bill of an encounter (DESIGN.md §7): charges, senior/PWD discount, PhilHealth package; finalize, pay, void. */
@Module({
	imports: [ClinicalDbModule, ClinicalAuditModule, OrganizationsModule, EncountersModule, WiseProposalsModule],
	providers: [BillingResolver, BillingService, BillingRepository],
})
export class BillingModule {}
