import { describe, expect, it, vi } from 'vitest';

import type { LlmService } from '../agent/llm/llm.service.js';
import type { MemoryRecord } from '../agent/types/memory.js';
import type { LlmInferenceService } from '../usage/llm-inference.service.js';
import type { MemoryRepository } from './memory.repository.js';
import { MemoryService } from './memory.service.js';

// Upstream has no memory service tests; these cover the parts loopwise rewrote (repository calls, model gating).
const extract = vi.fn();
vi.mock('./memory-extractor-llm.js', () => ({
	MemoryExtractorLLM: class {
		extract = extract;
	},
}));

function memory(id: string, category: MemoryRecord['category'] = 'global_rule'): MemoryRecord {
	return {
		id,
		userId: 'user-1',
		chatId: null,
		content: `Memory ${id}.`,
		category,
		supersededBy: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function createService(opts: { enabled?: boolean; existing?: MemoryRecord[] } = {}) {
	const repository = {
		getIsMemoryEnabledForUserAndClinic: vi.fn(async () => opts.enabled ?? true),
		getUserMemories: vi.fn(async () => opts.existing ?? []),
		upsertAndSupersedeMemories: vi.fn(async () => undefined),
	};
	const llm = {
		resolveDefaultModelSelection: vi.fn(async () => null),
		resolveAnnotationModelId: vi.fn(async () => 'claude-haiku-4-5'),
		resolveProviderModel: vi.fn(async () => ({ model: {}, providerOptions: {} })),
	};
	const inferences = { scheduleSave: vi.fn() };
	const service = new MemoryService(
		repository as unknown as MemoryRepository,
		llm as unknown as LlmService,
		inferences as unknown as LlmInferenceService,
	);
	return { service, repository, llm, inferences };
}

const extraction = {
	userId: 'user-1',
	clinicId: 'clinic-1',
	chatId: 'chat-1',
	messages: [],
	provider: 'anthropic' as const,
	modelId: 'claude-sonnet-4-5',
};

describe('MemoryService', () => {
	it('normalizes memory content to one trimmed sentence', () => {
		const { service } = createService();

		expect(service.normalizeMemoryContent('  always   use EUR ')).toBe('always use EUR.');
		expect(service.normalizeMemoryContent('Is this kept?')).toBe('Is this kept?');
		expect(service.normalizeMemoryContent('   ')).toBe('');
	});

	it('injects nothing when memory is disabled for the user or the clinic', async () => {
		const { service, repository } = createService({ enabled: false, existing: [memory('m1')] });

		await expect(service.safeGetUserMemories('user-1', 'clinic-1')).resolves.toEqual([]);
		expect(repository.getUserMemories).not.toHaveBeenCalled();
	});

	it('injects the active memories, excluding the current chat', async () => {
		const { service, repository } = createService({ existing: [memory('m1', 'personal_fact')] });

		await expect(service.safeGetUserMemories('user-1', 'clinic-1', 'chat-1')).resolves.toEqual([
			{ category: 'personal_fact', content: 'Memory m1.' },
		]);
		expect(repository.getUserMemories).toHaveBeenCalledWith('user-1', 'chat-1');
	});

	it('persists extracted memories and only supersedes memories that exist', async () => {
		const { service, repository, inferences } = createService({ existing: [memory('m1')] });
		extract.mockResolvedValueOnce({
			output: {
				user_instructions: [
					{ content: 'Always answer in French', supersedes_id: 'm1' },
					{ content: 'Never round numbers', supersedes_id: 'unknown' },
				],
				user_profile: [{ content: 'The user is a data analyst', supersedes_id: null }],
			},
			usage: { totalTokens: 42 },
		});

		await service.extractMemory(extraction);

		expect(inferences.scheduleSave).toHaveBeenCalledExactlyOnceWith({
			type: 'memory_extraction',
			clinicId: 'clinic-1',
			userId: 'user-1',
			chatId: 'chat-1',
			llmProvider: 'anthropic',
			llmModelId: 'claude-haiku-4-5',
			totalTokens: 42,
		});
		expect(repository.upsertAndSupersedeMemories).toHaveBeenCalledWith([
			{
				userId: 'user-1',
				chatId: 'chat-1',
				content: 'Always answer in French.',
				category: 'global_rule',
				supersedesId: 'm1',
			},
			{
				userId: 'user-1',
				chatId: 'chat-1',
				content: 'The user is a data analyst.',
				category: 'personal_fact',
				supersedesId: null,
			},
		]);
	});

	it('uses the model pinned for background tasks before the annotation model', async () => {
		const { service, llm } = createService();
		llm.resolveDefaultModelSelection.mockResolvedValueOnce({
			provider: 'openai',
			modelId: 'gpt-4.1-mini',
		} as never);
		extract.mockResolvedValueOnce(undefined);

		await service.extractMemory(extraction);

		expect(llm.resolveProviderModel).toHaveBeenCalledWith('clinic-1', 'openai', 'gpt-4.1-mini', false);
		expect(llm.resolveAnnotationModelId).not.toHaveBeenCalled();
	});

	it('skips extraction entirely when memory is disabled', async () => {
		const { service, llm } = createService({ enabled: false });

		await service.extractMemory(extraction);

		expect(llm.resolveProviderModel).not.toHaveBeenCalled();
	});
});
