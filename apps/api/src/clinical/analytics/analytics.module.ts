import { Module } from '@nestjs/common';

import type { AgentToolServices } from '../../agent/types/tools.js';
import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AnalyticsService } from './analytics.service.js';
import { ANALYTICS_READER } from './analytics-reader.token.js';

/** The agent reaches the service through `ANALYTICS_READER`, typed structurally: this fails the build when they drift. */
const readerMatches: AnalyticsService extends AgentToolServices['analytics'] ? true : never = true;
void readerMatches;

/** Safe analytics for Wise (DESIGN.md §7.2, §8.2): validated SQL and certified metrics on the analyst role. */
@Module({
	imports: [GuardsModule, AuditModule],
	providers: [AnalyticsService, AnalyticsRepository, { provide: ANALYTICS_READER, useExisting: AnalyticsService }],
	exports: [AnalyticsService, ANALYTICS_READER],
})
export class AnalyticsModule {}
