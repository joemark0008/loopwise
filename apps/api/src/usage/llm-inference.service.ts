import { Injectable, Logger } from '@nestjs/common';

import { LlmInferenceRepository, type NewLlmInference } from './llm-inference.repository.js';

/**
 * Port of upstream `utils/schedule-task.ts` `scheduleSaveLlmInferenceRecord`: records the token usage of an LLM call
 * made outside the chat's own messages (subagents, compaction, titles, memories, stories) without delaying the caller.
 */
@Injectable()
export class LlmInferenceService {
	private readonly logger = new Logger(LlmInferenceService.name);

	constructor(private readonly inferences: LlmInferenceRepository) {}

	scheduleSave(record: NewLlmInference): void {
		queueMicrotask(() => {
			this.inferences.insertLlmInference(record).catch((error: unknown) => {
				this.logger.error(`Saving the ${record.type} inference record failed: ${String(error)}`);
			});
		});
	}
}
