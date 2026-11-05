import { Module } from '@nestjs/common';

import { AttachmentsModule } from '../attachments/attachments.module.js';
import { ChatsCoreModule } from '../chats/chats-core.module.js';
import { AnalyticsModule } from '../clinical/analytics/analytics.module.js';
import { ClinicsCoreModule } from '../clinical/clinics/clinics/clinics-core.module.js';
import { DiagnosticsModule } from '../clinical/diagnostics/diagnostics.module.js';
import { EncountersModule } from '../clinical/encounters/encounters.module.js';
import { InsightsModule } from '../clinical/insights/insights.module.js';
import { PatientsModule } from '../clinical/patients/patients.module.js';
import { ReportsModule } from '../clinical/reports/reports.module.js';
import { MemoryModule } from '../memory/memory.module.js';
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
		ClinicsCoreModule,
		ChatsCoreModule,
		AttachmentsModule,
		SkillsModule,
		MemoryModule,
		PatientsModule,
		InsightsModule,
		AnalyticsModule,
		ReportsModule,
		DiagnosticsModule,
		EncountersModule,
		WiseToolsModule,
	],
	controllers: [AgentController],
	providers: [AgentService, CompactionService],
	exports: [AgentService, AgentCoreModule, CompactionService],
})
export class AgentModule {}
