import { Injectable, Logger } from '@nestjs/common';
import type { LlmProvider } from '@quarry/shared/types';

import { LlmService } from '../agent/llm/llm.service.js';
import { disableModelReasoning, getProviderMeta, type ProviderModelResult } from '../agent/providers/providers.js';
import type {
	ExtractorLLMOutput,
	MemoryCategory,
	MemoryExtractionOptions,
	MemoryRecord,
	NewMemoryRecord,
	UserInstruction,
	UserMemory,
	UserProfile,
} from '../agent/types/memory.js';
import { LlmInferenceService } from '../usage/llm-inference.service.js';
import { MemoryRepository } from './memory.repository.js';
import { MemoryExtractorLLM } from './memory-extractor-llm.js';

/**
 * Port of upstream `services/memory.ts`: injects a user's memories into the agent's system prompt and extracts new
 * ones in the background after each user message. Dropped: the PostHog event of each extraction.
 */
@Injectable()
export class MemoryService {
	private readonly logger = new Logger(MemoryService.name);

	constructor(
		private readonly memories: MemoryRepository,
		private readonly llm: LlmService,
		private readonly inferences: LlmInferenceService,
	) {}

	/** Safely gets active memories for a user to be injected into the system prompt. */
	async safeGetUserMemories(userId: string, projectId: string, excludeChatId?: string): Promise<UserMemory[]> {
		try {
			if (!(await this.memories.getIsMemoryEnabledForUserAndProject(userId, projectId))) {
				return [];
			}
			const memories = await this.memories.getUserMemories(userId, excludeChatId);
			return memories.map((memory) => ({ category: memory.category, content: memory.content }));
		} catch (error) {
			this.logger.error(`Memory injection failed: ${String(error)}`);
			return [];
		}
	}

	/** Safely schedules memory extraction for a user message. */
	safeScheduleMemoryExtraction(opts: MemoryExtractionOptions): void {
		this.extractMemory(opts).catch((error) => {
			this.logger.error(`Memory extraction failed for chat ${opts.chatId}: ${String(error)}`);
		});
	}

	listUserMemories(userId: string): Promise<MemoryRecord[]> {
		return this.memories.getUserMemories(userId);
	}

	isUserMemoryEnabled(userId: string): Promise<boolean> {
		return this.memories.getUserMemoryEnabled(userId);
	}

	isProjectMemoryEnabled(projectId: string): Promise<boolean> {
		return this.memories.getProjectMemoryEnabled(projectId);
	}

	setEnabled(userId: string, memoryEnabled: boolean): Promise<void> {
		return this.memories.setUserMemoryEnabled(userId, memoryEnabled);
	}

	updateContent(userId: string, memoryId: string, content: string): Promise<MemoryRecord | null> {
		return this.memories.updateUserMemoryContent(userId, memoryId, content);
	}

	delete(userId: string, memoryId: string): Promise<MemoryRecord | null> {
		return this.memories.deleteUserMemory(userId, memoryId);
	}

	normalizeMemoryContent(content: string): string {
		const normalized = content.trim().replace(/\s+/g, ' ');
		if (normalized.length === 0) {
			return normalized;
		}
		return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
	}

	/** Visible to tests: the extraction itself, without the error guard. */
	async extractMemory(opts: MemoryExtractionOptions): Promise<void> {
		if (!(await this.memories.getIsMemoryEnabledForUserAndProject(opts.userId, opts.projectId))) {
			return;
		}

		const pinned = await this.llm.resolveDefaultModelSelection(opts.projectId, 'other');
		const provider = pinned?.provider ?? opts.provider;
		const modelId =
			pinned?.modelId ?? (await this.getExtractorModelId(opts.projectId, opts.provider, opts.modelId));
		const model = await this.resolveModel(opts.projectId, provider, modelId);
		if (!model) {
			return;
		}

		const existingMemories = await this.memories.getUserMemories(opts.userId);
		const extractorResult = await new MemoryExtractorLLM(model).extract(existingMemories, opts.messages);
		if (!extractorResult) {
			return;
		}
		this.inferences.scheduleSave({
			type: 'memory_extraction',
			projectId: opts.projectId,
			userId: opts.userId,
			chatId: opts.chatId,
			llmProvider: provider,
			llmModelId: modelId,
			...extractorResult.usage,
		});

		await this.persistExtractedMemories({
			userId: opts.userId,
			chatId: opts.chatId,
			existingMemories,
			extractedMemories: extractorResult.output,
		});
	}

	private async resolveModel(
		projectId: string,
		provider: LlmProvider,
		modelId: string,
	): Promise<ProviderModelResult | null> {
		const model = await this.llm.resolveProviderModel(projectId, provider, modelId, false);
		return model ? disableModelReasoning(provider, model) : null;
	}

	private getExtractorModelId(projectId: string, provider: LlmProvider, selectedModelId: string): Promise<string> {
		return this.llm.resolveAnnotationModelId(
			projectId,
			{ provider, modelId: selectedModelId },
			getProviderMeta(provider).extractorModelId,
		);
	}

	private async persistExtractedMemories(opts: {
		userId: string;
		chatId: string;
		existingMemories: MemoryRecord[];
		extractedMemories: ExtractorLLMOutput;
	}): Promise<{ newCount: number; supersededCount: number }> {
		const existingIds = new Set(opts.existingMemories.map((memory) => memory.id));
		const instructions = opts.extractedMemories.user_instructions ?? [];
		const profile = opts.extractedMemories.user_profile ?? [];

		const newMemories = [
			...this.toNewMemories(instructions, 'global_rule', opts.userId, opts.chatId),
			...this.toNewMemories(profile, 'personal_fact', opts.userId, opts.chatId),
		].filter(({ supersedesId }) => (supersedesId ? existingIds.has(supersedesId) : true));

		if (newMemories.length) {
			await this.memories.upsertAndSupersedeMemories(newMemories);
		}

		const supersededCount = newMemories.filter((memory) => memory.supersedesId).length;
		return { newCount: newMemories.length - supersededCount, supersededCount };
	}

	private toNewMemories(
		items: (UserInstruction | UserProfile)[],
		category: MemoryCategory,
		userId: string,
		chatId: string,
	): NewMemoryRecord[] {
		return items.flatMap((item) => {
			const content = this.normalizeMemoryContent(item.content);
			return content ? [{ userId, content, category, chatId, supersedesId: item.supersedes_id }] : [];
		});
	}
}
