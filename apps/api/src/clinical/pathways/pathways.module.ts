import { Module } from '@nestjs/common';

import type { AgentToolServices } from '../../agent/types/tools.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { PathwayRepository } from './pathway.repository.js';
import { PathwaysResolver } from './pathways.resolver.js';
import { PathwaysService } from './pathways.service.js';
import { ResultEvaluationSubscriber } from './result-evaluation.subscriber.js';
import { RulesService } from './rules.service.js';
import { RULES_READER } from './rules-reader.token.js';

/** The agent reaches the service through `RULES_READER`, typed structurally: this fails the build when they drift. */
const readerMatches: RulesService extends AgentToolServices['rules'] ? true : never = true;
void readerMatches;

/**
 * Clinical pathways and the rules engine (DESIGN.md §2 "rules-first decisions", §6.2, §7, §8): validated pathway
 * definitions, deterministic result evaluations (on `result.received`) and their read API.
 */
@Module({
	imports: [ClinicalDbModule, ClinicalAuditModule],
	providers: [
		PathwaysResolver,
		PathwaysService,
		RulesService,
		PathwayRepository,
		ResultEvaluationSubscriber,
		{ provide: RULES_READER, useExisting: RulesService },
	],
	exports: [PathwaysService, RulesService, RULES_READER],
})
export class PathwaysModule {}
