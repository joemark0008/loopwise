import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const SKILL = 'pdf-handling';
const ANSWER = 'Attach the PDF and I will read the results from it.';

/**
 * Stream a chat through `POST /api/agent` and check that the tool call, its result and the final answer are saved.
 * The LLM is a scripted mock (no key, no network): the first step calls `load_skill`, the second answers.
 */
describe('agent chat (e2e)', () => {
	let app: NestExpressApplication;
	let cookie: string[] = [];
	let projectId = '';
	let chatId = '';

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.QUARRY_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'quarry-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockResolvedValue(scriptedModel());

		({ cookie } = await createTestUser(app, { name: 'Ada', email: 'ada@example.com', password: 'Sup3r-secret!' }));

		const project = await graphql('mutation { createProject(input: { name: "Clinic" }) { id } }');
		projectId = project.body.data.createProject.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-quarry-project-id': projectId } : {})
			.send({ query, variables });

	it('streams the run as an AI SDK UI message stream', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-quarry-project-id', projectId)
			.send({ message: { text: 'Can you read my old lab results?' }, model: MODEL })
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			})
			.expect(200);

		expect(res.headers['content-type']).toContain('text/event-stream');
		const events = parseSse(res.body as string);
		chatId = events.find((event) => event.type === 'data-newChat')?.data.id;
		expect(chatId).toBeTruthy();

		const toolInput = events.find((event) => event.type === 'tool-input-available');
		expect(toolInput).toMatchObject({ toolName: 'load_skill', input: { name: SKILL } });
		const toolOutput = events.find((event) => event.type === 'tool-output-available');
		expect(toolOutput?.output).toMatchObject({ name: SKILL });
		const text = events
			.filter((event) => event.type === 'text-delta')
			.map((event) => event.delta)
			.join('');
		expect(text).toBe(ANSWER);
		expect(events.at(-1)?.type).toBe('finish');
	});

	it('saves the user message, the tool call with its result and the answer', async () => {
		const res = await graphql('query ($chatId: ID!) { chat(chatId: $chatId) { title messages } }', { chatId });
		expect(res.body.errors).toBeUndefined();
		const [user, assistant] = res.body.data.chat.messages;

		expect(user).toMatchObject({
			role: 'user',
			parts: [{ type: 'text', text: 'Can you read my old lab results?' }],
		});
		expect(assistant.role).toBe('assistant');
		const skillPart = assistant.parts.find((part: { type: string }) => part.type === 'tool-load_skill');
		expect(skillPart).toMatchObject({ state: 'output-available', input: { name: SKILL }, output: { name: SKILL } });
		expect(assistant.parts.filter((part: { type: string }) => part.type === 'text').at(-1).text).toBe(ANSWER);
	});

	it('lists the chat', async () => {
		const list = await graphql('{ chatList { groups { chats { id } } } }');
		expect(list.body.data.chatList.groups.flatMap((group: { chats: unknown[] }) => group.chats)).toEqual([
			{ id: chatId },
		]);
	});
});

/** Step 1 calls `load_skill`, step 2 answers; `generateText` calls (the chat title) get a short title. */
function scriptedModel(): ProviderModelResult {
	let streamCalls = 0;
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Old lab results' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async () => {
			streamCalls += 1;
			const parts: LanguageModelV3StreamPart[] =
				streamCalls === 1
					? [
							{
								type: 'tool-call',
								toolCallId: 'call_skill',
								toolName: 'load_skill',
								input: JSON.stringify({ name: SKILL }),
							},
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: ANSWER },
							{ type: 'text-end', id: 'text_1' },
							{ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
						];
			return {
				stream: new ReadableStream<LanguageModelV3StreamPart>({
					start(controller) {
						controller.enqueue({ type: 'stream-start', warnings: [] });
						parts.forEach((part) => controller.enqueue(part));
						controller.close();
					},
				}),
			};
		},
	});
	return { model, providerOptions: {}, contextWindow: 128_000 } as unknown as ProviderModelResult;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE events of every type
function parseSse(body: string): any[] {
	return body
		.split('\n')
		.filter((line) => line.startsWith('data: {'))
		.map((line) => JSON.parse(line.slice('data: '.length)));
}
