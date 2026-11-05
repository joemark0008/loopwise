import './models/diagnostic-enums.js';

import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { DiagnosticTestRepository } from './catalog/diagnostic-test.repository.js';
import { DiagnosticTestService } from './catalog/diagnostic-test.service.js';
import { DiagnosticTestsResolver } from './catalog/diagnostic-tests.resolver.js';
import { DIAGNOSTICS_READER } from './diagnostics-reader.token.js';
import { DiagnosticsWiseReader } from './diagnostics-wise-reader.js';
import { LabDeskAccess } from './lab-desk-access.js';
import { DiagnosticOrderRepository } from './orders/diagnostic-order.repository.js';
import { DiagnosticOrderService } from './orders/diagnostic-order.service.js';
import { DiagnosticOrderTransitions } from './orders/diagnostic-order-transitions.service.js';
import { DiagnosticOrdersResolver } from './orders/diagnostic-orders.resolver.js';
import { DiagnosticResultRepository } from './results/diagnostic-result.repository.js';
import { ResultsResolver } from './results/results.resolver.js';
import { ResultsInboxService } from './results/results-inbox.service.js';
import { LabWorklistRepository } from './worklist/lab-worklist.repository.js';
import { LabWorklistResolver } from './worklist/lab-worklist.resolver.js';
import { LabWorklistService } from './worklist/lab-worklist.service.js';

/**
 * Diagnostics (schema `diagnostics.prisma`): the organization's test catalog (`catalog/`), a visit's lab and imaging
 * requests (`orders/`), the clinic's in-house lab desk that collects, runs, enters and releases results (`worklist/`),
 * and the doctor's results inbox and review (`results/`). Every status change goes through
 * `DiagnosticOrderTransitions`; Wise reads through `DIAGNOSTICS_READER`.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, DocumentSequencesModule, WiseProposalsModule, GuardsModule],
	providers: [
		LabDeskAccess,
		DiagnosticTestRepository,
		DiagnosticTestService,
		DiagnosticTestsResolver,
		DiagnosticOrderRepository,
		DiagnosticOrderTransitions,
		DiagnosticOrderService,
		DiagnosticOrdersResolver,
		LabWorklistRepository,
		LabWorklistService,
		LabWorklistResolver,
		DiagnosticResultRepository,
		ResultsInboxService,
		ResultsResolver,
		DiagnosticsWiseReader,
		{ provide: DIAGNOSTICS_READER, useExisting: DiagnosticsWiseReader },
	],
	exports: [DIAGNOSTICS_READER],
})
export class DiagnosticsModule {}
