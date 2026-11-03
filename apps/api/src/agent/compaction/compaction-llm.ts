import { generateText, ModelMessage } from 'ai';

import { COMPACTION_SYSTEM_PROMPT } from '../prompts/compaction-system-prompt.js';
import { COMPACTION_USER_PROMPT } from '../prompts/compaction-user-prompt.js';
import { type ProviderModelResult } from '../providers/providers.js';
import { ITokenCounter } from '../services/token-counter.js';
import { llmTelemetry } from '../telemetry.js';
import { CompactionResult, ICompactionLLM } from '../types/compaction.js';
import { convertToTokenUsage, selectMessagesInBudget } from '../utils/ai.js';
import { debugCompaction } from '../utils/debug.js';
import { stripImageParts, stripReasoningParts } from '../utils/model-message.js';

export const MAX_OUTPUT_TOKENS = 16_000;

export class CompactionLLM implements ICompactionLLM {
	readonly modelId: string;

	constructor(
		private readonly _model: ProviderModelResult,
		private readonly _tc: ITokenCounter,
	) {
		this.modelId = _model.model.modelId;
	}

	async compact(messages: ModelMessage[]): Promise<CompactionResult> {
		const modelMessages = this._buildModelMessages(messages);

		debugCompaction('Compaction LLM', { modelMessages });

		const { text, usage } = await generateText({
			...this._model,
			system: COMPACTION_SYSTEM_PROMPT,
			messages: modelMessages,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			experimental_telemetry: llmTelemetry('loopwise-compaction'),
		});

		return { summary: text, usage: convertToTokenUsage(usage) };
	}

	private _buildModelMessages(messages: ModelMessage[]): ModelMessage[] {
		const budget = this._getTokenBudget();
		const textOnlyMessages = stripReasoningParts(stripImageParts(messages));
		const selectedMessages = selectMessagesInBudget(textOnlyMessages, budget, this._tc);
		const modelMessages = this._composeMessages(selectedMessages);

		debugCompaction('message selection', {
			totalMessages: messages.length,
			selectedMessages: selectedMessages.length,
			droppedMessages: messages.length - selectedMessages.length,
			budget,
		});

		return modelMessages;
	}

	private _getTokenBudget(): number {
		const prefixAndSuffixMessages: ModelMessage[] = [
			{ role: 'system', content: COMPACTION_SYSTEM_PROMPT },
			{ role: 'user', content: COMPACTION_USER_PROMPT },
		];
		const prefixAndSuffixTokens = this._tc.estimateMessages(prefixAndSuffixMessages);
		return this._model.contextWindow - MAX_OUTPUT_TOKENS - prefixAndSuffixTokens;
	}

	private _composeMessages(selectedMessages: ModelMessage[]): ModelMessage[] {
		return [...selectedMessages, { role: 'user', content: COMPACTION_USER_PROMPT }];
	}
}
