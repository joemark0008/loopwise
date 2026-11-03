import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { ResultRepository } from './result.repository.js';
import { ResultIngestService } from './result-ingest.service.js';
import { ResultsResolver } from './results.resolver.js';
import { ResultsService } from './results.service.js';
import { RESULTS_READER } from './results-reader.token.js';

/** Results: stored by the HL7 ingest, reviewed by the ordering clinician in the results inbox (or from Wise). */
@Module({
	imports: [ClinicalDbModule, ClinicalAuditModule, OrdersModule, OrganizationsModule, WiseProposalsModule],
	providers: [
		ResultsResolver,
		ResultsService,
		ResultIngestService,
		ResultRepository,
		{ provide: RESULTS_READER, useExisting: ResultsService },
	],
	exports: [ResultIngestService, RESULTS_READER],
})
export class ResultsModule {}
