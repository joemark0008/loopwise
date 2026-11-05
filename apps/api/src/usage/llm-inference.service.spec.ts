import { describe, expect, it, vi } from 'vitest';

import type { LlmInferenceRepository, NewLlmInference } from './llm-inference.repository.js';
import { LlmInferenceService } from './llm-inference.service.js';

// Upstream has no tests for `scheduleSaveLlmInferenceRecord`; these cover the deferred save and its error guard.
const record: NewLlmInference = {
	type: 'subagent',
	clinicId: 'clinic-1',
	userId: 'user-1',
	chatId: 'chat-1',
	llmProvider: 'openai',
	llmModelId: 'gpt-4.1-mini',
	inputTotalTokens: 100,
	inputNoCacheTokens: 100,
	inputCacheReadTokens: 0,
	inputCacheWriteTokens: 0,
	outputTotalTokens: 20,
	outputTextTokens: 20,
	outputReasoningTokens: 0,
	totalTokens: 120,
};

function createService(insertLlmInference: LlmInferenceRepository['insertLlmInference']) {
	return new LlmInferenceService({ insertLlmInference } as LlmInferenceRepository);
}

describe('LlmInferenceService.scheduleSave', () => {
	it('saves the record after the caller continues', async () => {
		const insert = vi.fn(async () => undefined);

		createService(insert).scheduleSave(record);

		expect(insert).not.toHaveBeenCalled();
		await vi.waitFor(() => expect(insert).toHaveBeenCalledExactlyOnceWith(record));
	});

	it('does not throw when the save fails', async () => {
		const insert = vi.fn(async () => {
			throw new Error('database down');
		});

		expect(() => createService(insert).scheduleSave(record)).not.toThrow();
		await vi.waitFor(() => expect(insert).toHaveBeenCalledOnce());
	});
});
