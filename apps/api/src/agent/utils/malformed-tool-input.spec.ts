import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { convertToModelMessages, readUIMessageStream, streamText, tool, type UIMessage as GenericUIMessage } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import type { UIMessage } from '../types/chat.js';
import type { DBMessagePart } from '../types/db.js';
import { MALFORMED_TOOL_INPUT_ERROR_TEXT, settleToolParts } from './ai.js';
import { convertDBPartToUIPart, convertUIPartToDBPart } from './chat-message-part-mappings.js';

/** What a provider emits when the model stops (max tokens, dropped stream) in the middle of the arguments. */
const TRUNCATED_INPUT =
	'{"id":"sales-report","action":"create","title":"Sales","code":"# Sales\\n<chart query_id=\\"q1\\" chart_type=\\"bar';

const storyTool = tool({
	description: 'story',
	inputSchema: z.object({
		id: z.string(),
		action: z.string(),
		title: z.string().optional(),
		code: z.string().optional(),
	}),
	execute: async () => ({ success: true }),
});

describe('tool call cut off mid-arguments', () => {
	it('is sent back to the model on the next turn with an object input and an actionable error', async () => {
		const streamed = await streamTruncatedStoryCall();
		const streamedPart = findStoryPart(streamed);
		expect(streamedPart.state).toBe('output-error');
		expect(streamedPart.input).toBeUndefined();
		expect(streamedPart.rawInput).toBe(TRUNCATED_INPUT);

		const persisted = await roundTripThroughDatabase(streamed);
		const [settled] = await settleToolParts([persisted]);
		const settledPart = findStoryPart(settled);
		expect(settledPart.input).toEqual({
			id: 'sales-report',
			action: 'create',
			title: 'Sales',
			code: '# Sales\n<chart query_id="q1" chart_type="bar',
		});
		expect(settledPart.errorText).toBe(MALFORMED_TOOL_INPUT_ERROR_TEXT);

		const modelMessages = await convertToModelMessages<UIMessage>([settled], { tools: { story: storyTool } });
		const toolCall = findContentPart(modelMessages[0], 'tool-call');
		expect(toolCall.input).toEqual(settledPart.input);
		const toolResult = findContentPart(modelMessages[1], 'tool-result');
		expect(toolResult.output).toEqual({ type: 'error-text', value: MALFORMED_TOOL_INPUT_ERROR_TEXT });
	});

	it('would otherwise reach the model as the raw unbalanced text', async () => {
		const persisted = await roundTripThroughDatabase(await streamTruncatedStoryCall());
		const modelMessages = await convertToModelMessages<UIMessage>([persisted], { tools: { story: storyTool } });
		expect(findContentPart(modelMessages[0], 'tool-call').input).toBe(TRUNCATED_INPUT);
	});
});

async function streamTruncatedStoryCall(): Promise<UIMessage> {
	const result = streamText({ model: truncatedToolCallModel(), tools: { story: storyTool }, prompt: 'go' });
	let message: GenericUIMessage | undefined;
	for await (const update of readUIMessageStream({ stream: result.toUIMessageStream() })) {
		message = update;
	}
	return message as UIMessage;
}

function truncatedToolCallModel() {
	return new MockLanguageModelV3({
		doStream: async () => ({
			stream: new ReadableStream({
				start(controller) {
					controller.enqueue({ type: 'stream-start', warnings: [] });
					controller.enqueue({ type: 'tool-input-start', id: 'call_1', toolName: 'story' });
					controller.enqueue({ type: 'tool-input-delta', id: 'call_1', delta: TRUNCATED_INPUT });
					controller.enqueue({ type: 'tool-input-end', id: 'call_1' });
					controller.enqueue({
						type: 'tool-call',
						toolCallId: 'call_1',
						toolName: 'story',
						input: TRUNCATED_INPUT,
					});
					controller.enqueue({
						type: 'finish',
						finishReason: 'length',
						usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
					} as unknown as LanguageModelV3StreamPart);
					controller.close();
				},
			}),
		}),
	});
}

/** Mirrors `upsertMessage` + `getChatMessages`: JSON columns come back as `null` when unset. */
async function roundTripThroughDatabase(message: UIMessage): Promise<UIMessage> {
	const parts = message.parts
		.map((part, index) => convertUIPartToDBPart(part, message.id, index))
		.filter((part) => part !== undefined)
		.map((part) => ({ ...part, toolInput: part.toolInput ?? null }) as DBMessagePart)
		.map((part) => convertDBPartToUIPart(part))
		.filter((part) => part !== undefined);
	return { ...message, parts };
}

function findStoryPart(message: UIMessage) {
	const part = message.parts.find((candidate) => (candidate.type as string) === 'tool-story');
	if (!part) {
		throw new Error('No story tool part found');
	}
	// `story` isn't one of quarry's tool parts yet (its write path isn't ported), so type the part loosely.
	return part as unknown as { state: string; input?: unknown; rawInput?: unknown; errorText?: string };
}

function findContentPart(message: { content: unknown }, type: string) {
	const content = message.content as { type: string; input?: unknown; output?: unknown }[];
	const part = content.find((candidate) => candidate.type === type);
	if (!part) {
		throw new Error(`No ${type} part found`);
	}
	return part;
}
