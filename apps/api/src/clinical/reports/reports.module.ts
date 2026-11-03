import { Module } from '@nestjs/common';

import type { AgentToolServices } from '../../agent/types/tools.js';
import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { ReportsRepository } from './reports.repository.js';
import { ReportsResolver } from './reports.resolver.js';
import { ReportsService } from './reports.service.js';
import { REPORTS_READER } from './reports-reader.token.js';

/** The agent reaches the service through `REPORTS_READER`, typed structurally: this fails the build when they drift. */
const readerMatches: ReportsService extends AgentToolServices['reports'] ? true : never = true;
void readerMatches;

/** Wise reports in a side panel (DESIGN.md §9.2): versions from the chat, PDF export. */
@Module({
	imports: [ClinicalDbModule, ChatsCoreModule, WiseProposalsModule],
	providers: [
		ReportsResolver,
		ReportsService,
		ReportsRepository,
		{ provide: REPORTS_READER, useExisting: ReportsService },
	],
	exports: [ReportsService, REPORTS_READER],
})
export class ReportsModule {}
