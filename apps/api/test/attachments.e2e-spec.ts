import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { __resetStorageForTesting } from '../src/attachments/storage/index.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const CSV = 'week,customers\n1,42\n';
/** A 1×1 transparent PNG. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Phase 2d on Postgres: `POST /api/attachments` into local permanent storage, the bytes back through
 * `/api/attachments/file`, the `storage*` queries (upstream tRPC `storage.*`), and an agent message carrying an
 * uploaded document and an image: both saved as `file` parts, the image inlined for the model and the document
 * described by its path. Upstream has no route test for attachments; these follow `routes/attachment.ts`.
 */
describe('attachments (e2e)', () => {
	let app: NestExpressApplication;
	let cookie: string[] = [];
	let projectId = '';
	let storageRoot = '';
	const prompts: LanguageModelV3CallOptions['prompt'][] = [];

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-projects-'));
		storageRoot = await mkdtemp(path.join(tmpdir(), 'loopwise-storage-e2e-'));
		process.env.LOOPWISE_STORAGE_BACKEND = 'local';
		process.env.LOOPWISE_STORAGE_LOCAL_PATH = storageRoot;
		process.env.LOOPWISE_STORAGE_MAX_FILE_SIZE_MB = '1';
		__resetStorageForTesting();
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockResolvedValue(
			recordingModel(prompts),
		);

		({ cookie } = await createTestUser(app, { name: 'Ada', email: 'ada@example.com', password: 'Sup3r-secret!' }));
		const project = await graphql('mutation { createProject(input: { name: "Files" }) { id } }');
		projectId = project.body.data.createProject.id;
	});

	afterAll(async () => {
		await app?.close();
		delete process.env.LOOPWISE_STORAGE_LOCAL_PATH;
		delete process.env.LOOPWISE_STORAGE_MAX_FILE_SIZE_MB;
		__resetStorageForTesting();
		await rm(storageRoot, { recursive: true, force: true });
	});

	const graphql = (query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-loopwise-project-id': projectId } : {})
			.send({ query, variables });

	const upload = (data: Buffer | string, filename: string) =>
		request(app.getHttpServer())
			.post('/api/attachments')
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.attach('file', Buffer.from(data), filename);

	const today = () => new Date().toISOString().slice(0, 10);

	it('stores an upload in the sender’s space and answers with its virtual path', async () => {
		const res = await upload(CSV, 'sales.csv').expect(200);

		expect(res.body).toEqual({
			path: `/home/uploads/${today()}/sales.csv`,
			filename: 'sales.csv',
			mediaType: 'text/csv',
			size: CSV.length,
		});
	});

	it('never replaces an existing file: a taken name gets a suffix', async () => {
		const res = await upload(CSV, 'sales.csv').expect(200);
		expect(res.body.path).toBe(`/home/uploads/${today()}/sales-2.csv`);
	});

	it('refuses a file type it cannot use, and a file above the size limit', async () => {
		const binary = await upload('MZ', 'tool.exe').expect(400);
		expect(binary.body.error).toBe('tool.exe is not a file type Loopwise accepts');

		const big = await upload(Buffer.alloc(1024 * 1024 + 1, 'a'), 'big.csv').expect(400);
		expect(big.body.error).toBe('big.csv is larger than the 1 MB upload limit');
	});

	it('rejects a request without a file, or without a session', async () => {
		const empty = await request(app.getHttpServer())
			.post('/api/attachments')
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.field('note', 'no file')
			.expect(400);
		expect(empty.body.error).toBe('No file uploaded');

		await request(app.getHttpServer())
			.post('/api/attachments')
			.attach('file', Buffer.from(CSV), 'a.csv')
			.expect(401);
	});

	it('serves the bytes back as a download, and the size on HEAD', async () => {
		const filePath = `/home/uploads/${today()}/sales.csv`;
		const res = await request(app.getHttpServer())
			.get('/api/attachments/file')
			.query({ path: filePath })
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			})
			.expect(200);
		expect(res.body).toBe(CSV);
		expect(res.headers['content-type']).toContain('text/csv');
		expect(res.headers['content-disposition']).toBe("attachment; filename*=UTF-8''sales.csv");
		expect(res.headers['x-content-type-options']).toBe('nosniff');

		const head = await request(app.getHttpServer())
			.head('/api/attachments/file')
			.query({ path: filePath })
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.expect(200);
		expect(head.headers['content-length']).toBe(String(CSV.length));

		const missing = await request(app.getHttpServer())
			.get('/api/attachments/file')
			.query({ path: '/home/nope.csv' })
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.expect(404);
		expect(missing.body.error).toBe('No such file in permanent storage: /home/nope.csv');

		await request(app.getHttpServer())
			.get('/api/attachments/file')
			.query({ path: '/RULES.md' })
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.expect(400);
	});

	it('reports the storage config, health, upload limits and usage', async () => {
		const res = await graphql('{ storageConfig storageHealth storageUploadLimits storageUsage }');
		expect(res.body.errors).toBeUndefined();
		const { storageConfig, storageHealth, storageUploadLimits, storageUsage } = res.body.data;

		expect(storageConfig).toEqual({ backend: 'local', maxFileSizeMb: 1, local: { path: storageRoot } });
		expect(storageHealth).toMatchObject({ ok: true });
		expect(typeof storageHealth.checkedAt).toBe('string');
		expect(storageUploadLimits).toEqual({ enabled: true, maxFileSizeMb: 1 });
		expect(storageUsage.own).toEqual({ fileCount: 2, totalBytes: 2 * CSV.length });
		expect(storageUsage.byUser).toEqual([
			expect.objectContaining({ name: 'Ada', fileCount: 2, totalBytes: 2 * CSV.length }),
		]);
	});

	it('saves an uploaded document and an image on the user message, and shows both to the model', async () => {
		const documentPath = `/home/uploads/${today()}/sales.csv`;
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.send({
				message: {
					text: 'What is in these?',
					documents: [documentPath],
					images: [{ mediaType: 'image/png', data: PNG_BASE64 }],
				},
				model: MODEL,
			})
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			})
			.expect(200);
		const chatId = parseSse(res.body as string).find((event) => event.type === 'data-newChat')?.data.id;
		expect(chatId).toBeTruthy();

		const chat = await graphql('query ($chatId: ID!) { chat(chatId: $chatId) { messages } }', { chatId });
		const [user] = chat.body.data.chat.messages;
		expect(user.parts).toEqual([
			{ type: 'text', text: 'What is in these?' },
			{ type: 'file', mediaType: 'image/png', url: expect.stringMatching(/^\/i\/[a-f0-9-]+$/) },
			{ type: 'file', mediaType: 'text/csv', filename: 'sales.csv', url: documentPath },
		]);

		const userPrompt = prompts[0]?.find((message) => message.role === 'user');
		expect(userPrompt?.content).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ type: 'file', mediaType: 'image/png' }),
				expect.objectContaining({
					type: 'text',
					text: expect.stringContaining(`It is saved at ${documentPath}.`),
				}),
			]),
		);
	});

	it('rejects a message pointing at a file that is not in the sender’s space', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-loopwise-project-id', projectId)
			.send({ message: { text: 'Read it', documents: ['/home/missing.csv'] }, model: MODEL })
			.expect(400);
		expect(res.body.error).toBe('Attached file not found: /home/missing.csv');
	});
});

/** Answers every step with a short text and records the prompts it was sent. */
function recordingModel(prompts: LanguageModelV3CallOptions['prompt'][]): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Attachments' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async (options) => {
			prompts.push(options.prompt);
			const parts: LanguageModelV3StreamPart[] = [
				{ type: 'text-start', id: 'text_1' },
				{ type: 'text-delta', id: 'text_1', delta: 'A sales CSV and a picture.' },
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
