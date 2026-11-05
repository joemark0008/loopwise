import type { LlmProvider } from '@loopwise/shared/types';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ModelMessage, Tool } from 'ai';

import { LlmInferenceService } from '../../usage/llm-inference.service.js';
import { CompactionLLM } from '../compaction/index.js';
import { LlmService } from '../llm/llm.service.js';
import { renderToMarkdown, XML } from '../markdown/index.js';
import { getProviderMeta } from '../providers/provider-meta.js';
import { disableModelReasoning } from '../providers/providers.js';
import type { CompactionPart, TokenUsage, UIMessage } from '../types/chat.js';
import type { ICompactionLLM } from '../types/compaction.js';
import {
	findFirstNonSystemMessageIndex,
	findLastCompactionPart,
	findLastUserMessage,
	findLastUserMessageIndex,
} from '../utils/ai.js';
import { debugCompaction } from '../utils/debug.js';
import { sanitizeToolCalls } from '../utils/model-message.js';
import { type ITokenCounter, TokenCounter } from './token-counter.js';

const CONTEXT_WINDOW_COMPACTION_THRESHOLD = 0.75;

export interface CompactIfNeededOptions extends CompactConversationOptions {
	onCompactionStarted: () => void;
	onCompactionFinished: (result: CompactionPart) => void;
}

interface CompactionResult {
	summary: string;
	usage: TokenUsage;
}

interface CompactConversationOptions {
	chat: { id: string; clinicId: string; userId: string };
	provider: LlmProvider;
	modelId: string;
	messages: ModelMessage[];
	tools: Record<string, Tool>;
	maxOutputTokens: number;
	contextWindow: number;
}

interface ResolvedCompactionLLM {
	llm: ICompactionLLM;
	provider: LlmProvider;
}

export interface CompactionServiceOptions {
	createCompactionLlm: (...args: ConstructorParameters<typeof CompactionLLM>) => ICompactionLLM;
	tokenCounter: ITokenCounter;
}

export const COMPACTION_SERVICE_OPTIONS = Symbol('COMPACTION_SERVICE_OPTIONS');

const defaultOptions: CompactionServiceOptions = {
	createCompactionLlm: (...args) => new CompactionLLM(...args),
	tokenCounter: new TokenCounter(),
};

export class CompactionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CompactionError';
	}
}

/**
 * Compaction state of a single agent run. The AI SDK rebuilds the step input from the original
 * history on every step, so the summary must be reapplied each step and is computed at most once.
 */
export class RunCompaction {
	private _attempted = false;
	private _summary: string | undefined;

	constructor(private readonly service: CompactionService) {}

	async apply(opts: CompactIfNeededOptions): Promise<void> {
		if (this._attempted) {
			this._reapply(opts.messages);
			return;
		}

		await this.service.compactConversationIfNeeded({
			...opts,
			onCompactionStarted: () => {
				this._attempted = true;
				opts.onCompactionStarted();
			},
			onCompactionFinished: (result) => {
				this._summary = result.error ? undefined : result.summary;
				opts.onCompactionFinished(result);
			},
		});
	}

	private _reapply(messages: ModelMessage[]): void {
		if (this._summary !== undefined) {
			this.service.applySummary(messages, this._summary);
		}
	}
}

/** Port of upstream `services/compaction.ts`. Model resolution goes through `LlmService`. */
@Injectable()
export class CompactionService {
	private readonly _tc: ITokenCounter;
	private readonly options: CompactionServiceOptions;

	constructor(
		private readonly llmService: LlmService,
		private readonly inferences: LlmInferenceService,
		@Optional() @Inject(COMPACTION_SERVICE_OPTIONS) options?: CompactionServiceOptions,
	) {
		this.options = options ?? defaultOptions;
		this._tc = this.options.tokenCounter;
	}

	/** Rebuilds conversation history from the latest stored compaction marker. */
	useLastCompaction(messages: UIMessage[]): Omit<UIMessage, 'id'>[] {
		const [lastCompaction, messageIdx] = findLastCompactionPart(messages);
		if (!lastCompaction) {
			return messages;
		}

		return this._addPartialSummary(messages, lastCompaction.summary, messageIdx);
	}

	/** Rehydrates a partial compaction by prepending the summary to remaining recent messages. */
	private _addPartialSummary(
		messages: UIMessage[],
		compactionSummary: string,
		compactionMessageIdx: number,
	): Omit<UIMessage, 'id'>[] {
		const [_, userMessageBeforeCompactionIdx] = findLastUserMessage(messages, { beforeIdx: compactionMessageIdx });
		if (userMessageBeforeCompactionIdx === undefined) {
			return messages;
		}

		const selectedMessages = messages.slice(userMessageBeforeCompactionIdx);
		return [this._createSummaryUIMessage(compactionSummary), ...selectedMessages];
	}

	/** Replaces the history before the latest user message with the summary, in place. */
	applySummary(messages: ModelMessage[], summary: string): void {
		const firstNonSystemIndex = findFirstNonSystemMessageIndex(messages);
		const lastUserIndex = findLastUserMessageIndex(messages);
		if (firstNonSystemIndex === -1 || lastUserIndex <= firstNonSystemIndex) {
			return;
		}

		messages.splice(
			firstNonSystemIndex,
			lastUserIndex - firstNonSystemIndex,
			this._createSummaryModelMessage(summary),
		);
	}

	private _createSummaryUIMessage(summary: string): Omit<UIMessage, 'id'> {
		return {
			role: 'assistant',
			parts: [{ type: 'text', text: summary }],
		};
	}

	/**
	 * Triggers compaction if the conversation exceeds the configured threshold.
	 */
	async compactConversationIfNeeded({
		onCompactionStarted,
		onCompactionFinished,
		...opts
	}: CompactIfNeededOptions): Promise<CompactionPart | undefined> {
		const shouldCompact = await this._shouldCompact(opts);
		if (!shouldCompact) {
			return undefined;
		}

		onCompactionStarted();

		try {
			const result = await this._compactConversation(opts);
			onCompactionFinished(result);
			return result;
		} catch (error) {
			onCompactionFinished({ summary: '', error: String(error) });
			return undefined;
		}
	}

	private async _shouldCompact({
		messages,
		tools,
		maxOutputTokens,
		contextWindow,
	}: CompactConversationOptions): Promise<boolean> {
		const messageTokens = this._tc.estimateMessages(messages);
		const toolTokens = await this._tc.estimateTools(tools);
		const total = messageTokens + toolTokens + maxOutputTokens;
		const threshold = contextWindow * CONTEXT_WINDOW_COMPACTION_THRESHOLD;

		debugCompaction('token estimate', { messageTokens, toolTokens, total, threshold });
		return total > threshold;
	}

	/**
	 * Compacts the conversation by summarizing the messages up to the latest user message (last user/assistant turn).
	 * All messages after the last user message are kept veribatim in the conversation.
	 */
	private async _compactConversation(opts: CompactConversationOptions): Promise<CompactionResult> {
		const lastUserIndex = this._findLastUserMessageIndex(opts.messages);
		const firstNonSystemIndex = this._findFirstNonSystemMessageIndex(opts.messages);

		if (firstNonSystemIndex > lastUserIndex) {
			throw new CompactionError('User message must come after the first non-system message.');
		}

		const compaction = await this._resolveCompactionLLM(opts.chat, opts.provider, opts.modelId);
		if (!compaction) {
			throw new CompactionError('Failed to resolve LLM.');
		}

		const result = await this._compactUpToLastUserMessage(compaction, opts, firstNonSystemIndex, lastUserIndex);
		this._trackInference(opts, compaction.provider, compaction.llm.modelId, result.usage);

		return result;
	}

	private _findLastUserMessageIndex(messages: ModelMessage[]): number {
		const index = findLastUserMessageIndex(messages);
		if (index === -1) {
			throw new CompactionError('Messages must contain a user message.');
		}
		return index;
	}

	private _findFirstNonSystemMessageIndex(messages: ModelMessage[]): number {
		const index = findFirstNonSystemMessageIndex(messages);
		if (index === -1) {
			throw new CompactionError('Messages must contain a non-system message.');
		}
		return index;
	}

	private async _resolveCompactionLLM(
		chat: CompactConversationOptions['chat'],
		provider: LlmProvider,
		selectedModelId: string,
	): Promise<ResolvedCompactionLLM | undefined> {
		const pinned = await this.llmService.resolveDefaultModelSelection(chat.clinicId, 'compaction');
		const effectiveProvider = pinned?.provider ?? provider;
		const modelId =
			pinned?.modelId ??
			(await this.llmService.resolveAnnotationModelId(
				chat.clinicId,
				{ provider, modelId: selectedModelId },
				getProviderMeta(provider).extractorModelId,
			));
		const model = await this.llmService.resolveProviderModel(chat.clinicId, effectiveProvider, modelId, false);
		if (!model) {
			return undefined;
		}
		return {
			llm: this.options.createCompactionLlm(disableModelReasoning(effectiveProvider, model), this._tc),
			provider: effectiveProvider,
		};
	}

	/** Summarizes conversation up to the latest user message and replaces that range in-place. */
	private async _compactUpToLastUserMessage(
		{ llm, provider }: ResolvedCompactionLLM,
		opts: CompactConversationOptions,
		firstNonSystemIndex: number,
		lastUserIndex: number,
	): Promise<CompactionResult> {
		if (firstNonSystemIndex === lastUserIndex) {
			throw new CompactionError('Conversation must contain non-system messages before the user message.');
		}

		const messagesToSummarize = opts.messages.slice(firstNonSystemIndex, lastUserIndex);
		const { summary, usage } = await llm.compact(sanitizeToolCalls(messagesToSummarize, provider));
		this.applySummary(opts.messages, summary);

		return { summary, usage };
	}

	private _createSummaryModelMessage(summary: string): ModelMessage {
		return {
			role: 'assistant',
			content: renderToMarkdown(
				XML({
					tag: 'conversation-summary',
					children: [summary],
				}),
			),
		};
	}

	private _trackInference(
		opts: CompactConversationOptions,
		provider: LlmProvider,
		modelId: string,
		usage: TokenUsage,
	): void {
		this.inferences.scheduleSave({
			type: 'compaction',
			clinicId: opts.chat.clinicId,
			userId: opts.chat.userId,
			chatId: opts.chat.id,
			llmProvider: provider,
			llmModelId: modelId,
			...usage,
		});
	}
}
