import { generateText, ModelMessage, Output } from 'ai';

import { MEMORY_EXTRACTION_SYSTEM_PROMPT } from '../agent/prompts/memory-system-prompt.js';
import { renderMemoryExtractionUserMessage } from '../agent/prompts/memory-user-prompt.js';
import { type ProviderModelResult } from '../agent/providers/providers.js';
import { llmTelemetry } from '../agent/telemetry.js';
import type { TokenUsage, UIMessage } from '../agent/types/chat.js';
import type { MemoryRecord } from '../agent/types/memory.js';
import type { ExtractorLLMOutput } from '../agent/types/memory.js';
import { ExtractorOutputSchema } from '../agent/types/memory.js';
import {
	convertToTokenUsage,
	findLastUserMessage,
	getLastUserMessageText,
	joinAllTextParts,
} from '../agent/utils/ai.js';
import { debugMemory } from '../agent/utils/debug.js';
import { truncateMiddle } from '../agent/utils/utils.js';

interface MemoryExtractorResult {
	output: ExtractorLLMOutput;
	usage: TokenUsage;
}

const MAX_OUTPUT_TOKENS = 4000;
const CONVERSATION_MESSAGE_LIMIT = 17;
const MESSAGE_CHAR_LIMIT = 1_250;
const LAST_USER_MESSAGE_CHAR_LIMIT = 2_000;
const MIN_USER_TEXT_LENGTH = 3;

/**
 * Sends existing memories and recent conversation to an LLM and returns new memories to be persisted.
 */
export class MemoryExtractorLLM {
	constructor(private readonly model: ProviderModelResult) {}

	async extract(memories: MemoryRecord[], uiMessages: UIMessage[]): Promise<MemoryExtractorResult | undefined> {
		const lastUserText = getLastUserMessageText(uiMessages);
		if (!uiMessages.length || lastUserText.length < MIN_USER_TEXT_LENGTH) {
			return undefined;
		}

		const modelMessages = this._buildModelMessages(memories, uiMessages);

		debugMemory('modelMessages', modelMessages);

		const { output, usage } = await generateText({
			...this.model,
			output: Output.object({ schema: ExtractorOutputSchema }),
			system: MEMORY_EXTRACTION_SYSTEM_PROMPT,
			messages: modelMessages,
			maxOutputTokens: MAX_OUTPUT_TOKENS,
			experimental_telemetry: llmTelemetry('loopwise-memory-extraction'),
		});

		debugMemory('output', output);

		return { output, usage: convertToTokenUsage(usage) };
	}

	private _buildModelMessages(memories: MemoryRecord[], uiMessages: UIMessage[]): ModelMessage[] {
		return [...this._buildConversationMessages(uiMessages), this._buildUserMemoryMessage(memories)];
	}

	private _buildConversationMessages(uiMessages: UIMessage[]): ModelMessage[] {
		const recent = uiMessages.slice(-CONVERSATION_MESSAGE_LIMIT);
		const modelMessages: ModelMessage[] = [];
		const [lastUserMessage] = findLastUserMessage(recent);

		for (const message of recent) {
			if (message.role !== 'user' && message.role !== 'assistant') {
				continue;
			}
			const isLastUserMessage = message === lastUserMessage;
			const maxLength = isLastUserMessage ? LAST_USER_MESSAGE_CHAR_LIMIT : MESSAGE_CHAR_LIMIT;
			const text = truncateMiddle(joinAllTextParts(message), maxLength);
			if (!text) {
				continue;
			}
			modelMessages.push({ role: message.role, content: text });
		}

		return modelMessages;
	}

	private _buildUserMemoryMessage(memories: MemoryRecord[]): ModelMessage {
		return { role: 'user', content: renderMemoryExtractionUserMessage(memories) };
	}
}
