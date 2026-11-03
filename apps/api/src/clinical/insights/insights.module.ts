import { Module } from '@nestjs/common';

import type { AgentToolServices } from '../../agent/types/tools.js';
import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { InsightsRepository } from './insights.repository.js';
import { InsightsResolver } from './insights.resolver.js';
import { InsightsService } from './insights.service.js';
import { INSIGHTS_READER } from './insights-reader.token.js';

/** The agent reaches the service through `INSIGHTS_READER`, typed structurally: this fails the build when they drift. */
const readerMatches: InsightsService extends AgentToolServices['insights'] ? true : never = true;
void readerMatches;

/** Wise charts and summary reports (DESIGN.md §9.2): fixed clinical datasets read as the user, and their PDF. */
@Module({
	imports: [ClinicalDbModule, ChatsCoreModule, OrganizationsModule],
	providers: [
		InsightsResolver,
		InsightsService,
		InsightsRepository,
		{ provide: INSIGHTS_READER, useExisting: InsightsService },
	],
	exports: [InsightsService, INSIGHTS_READER],
})
export class InsightsModule {}
