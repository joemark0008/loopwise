import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module.js';
import { ChatsCoreModule } from '../chats/chats-core.module.js';
import { AnalyticsModule } from '../clinical/analytics/analytics.module.js';
import { EncountersModule } from '../clinical/encounters/encounters.module.js';
import { InsightsModule } from '../clinical/insights/insights.module.js';
import { OrdersModule } from '../clinical/orders/orders.module.js';
import { PathwaysModule } from '../clinical/pathways/pathways.module.js';
import { PatientsModule } from '../clinical/patients/patients.module.js';
import { ReportsModule } from '../clinical/reports/reports.module.js';
import { ResultsModule } from '../clinical/results/results.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ProjectsCoreModule } from '../projects/projects-core.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { WiseToolsModule } from '../wise-tools/wise-tools.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { AgentCoreModule } from './agent-core.module.js';
import { CompactionService } from './services/compaction.js';

/** The chat agent: `POST /api/agent`, model resolution and the tool registry (PLAN.md §6 `agent`). */
@Module({
	imports: [
		AgentCoreModule,
		ProjectsCoreModule,
		ChatsCoreModule,
		AttachmentsModule,
		SkillsModule,
		MemoryModule,
		PatientsModule,
		InsightsModule,
		AnalyticsModule,
		ReportsModule,
		ResultsModule,
		OrdersModule,
		EncountersModule,
		WiseToolsModule,
		PathwaysModule,
	],
	controllers: [AgentController],
	providers: [AgentService, CompactionService],
	exports: [AgentService, AgentCoreModule, CompactionService],
})
export class AgentModule {}
