import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { ClinicalEventsService } from '../events/clinical-events.service.js';
import { RulesService } from './rules.service.js';

/**
 * Evaluates every stored result (DESIGN.md §6.3 step 3): on `result.received` the rules engine evaluates it and stores
 * why, then publishes `result.evaluated`. Opening or advancing the case is the case engine's, on that event.
 */
@Injectable()
export class ResultEvaluationSubscriber implements OnModuleInit, OnModuleDestroy {
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly events: ClinicalEventsService,
		private readonly rules: RulesService,
	) {}

	onModuleInit(): void {
		this.unsubscribe = this.events.on('result.received', async ({ resultId }) => {
			await this.rules.evaluateAndStore(resultId);
		});
	}

	onModuleDestroy(): void {
		this.unsubscribe?.();
	}
}
