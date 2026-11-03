import { Module } from '@nestjs/common';

import { AgentCoreModule } from '../agent/agent-core.module.js';
import { MemoryRepository } from './memory.repository.js';
import { MemoryResolver } from './memory.resolver.js';
import { MemoryService } from './memory.service.js';

/** User memories (upstream `memory`): the settings API and the service the agent injects and extracts with. */
@Module({
	imports: [AgentCoreModule],
	providers: [MemoryRepository, MemoryService, MemoryResolver],
	exports: [MemoryService],
})
export class MemoryModule {}
