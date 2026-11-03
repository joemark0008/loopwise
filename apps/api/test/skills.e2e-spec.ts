import { existsSync } from 'node:fs';
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
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const CREATE = 'mutation ($input: CreateSkillInput!) { createSkill(input: $input) { name location } }';
const DRAFT = { name: 'churn-analysis', description: 'Use for churn questions.', body: '1. Do the thing.' };

describe('skills (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let projectId = '';
	let projectPath = '';
	let adminCookie: string[] = [];
	let contextAdminCookie: string[] = [];
	let memberCookie: string[] = [];
	let viewerCookie: string[] = [];

	const signUp = (name: string, email: string) => createTestUser(app, { name, email, password: 'Sup3r-secret!' });

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-loopwise-project-id': projectId } : {})
			.send({ query, variables });

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockResolvedValue(scriptedModel());

		const admin = await signUp('Ada', 'ada@example.com');
		adminCookie = admin.cookie;
		const contextAdmin = await signUp('Cleo', 'cleo@example.com');
		contextAdminCookie = contextAdmin.cookie;
		const member = await signUp('Bob', 'bob@example.com');
		memberCookie = member.cookie;
		const viewer = await signUp('Vic', 'vic@example.com');
		viewerCookie = viewer.cookie;

		const project = await graphql(adminCookie, 'mutation { createProject(input: { name: "Jaffle" }) { id } }');
		projectId = project.body.data.createProject.id;
		projectPath = (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).path as string;
		await prisma.projectMember.createMany({
			data: [
				{ projectId, userId: contextAdmin.userId, role: 'context_admin' },
				{ projectId, userId: member.userId, role: 'user' },
				{ projectId, userId: viewer.userId, role: 'viewer' },
			],
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	it('saves directly in the project folder', async () => {
		const status = await graphql(adminCookie, '{ skillSaveStatus { mode message } }');
		expect(status.body.data.skillSaveStatus).toEqual({ mode: 'direct', message: null });
	});

	it('refuses members and viewers', async () => {
		for (const cookie of [memberCookie, viewerCookie]) {
			const created = await graphql(cookie, CREATE, { input: DRAFT });
			expect(created.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
		}
		expect(existsSync(path.join(projectPath, 'agent', 'skills', `${DRAFT.name}.md`))).toBe(false);
	});

	it('lets an admin create a skill that every member can then use', async () => {
		const created = await graphql(adminCookie, CREATE, { input: DRAFT });
		expect(created.body.errors).toBeUndefined();
		expect(created.body.data.createSkill).toEqual({
			name: DRAFT.name,
			location: '/agent/skills/churn-analysis.md',
		});

		const list = await graphql(memberCookie, '{ skills { name description } }');
		expect(list.body.data.skills).toEqual([{ name: DRAFT.name, description: DRAFT.description }]);
	});

	it('lets a context admin edit and delete a skill', async () => {
		const detail = await graphql(
			contextAdminCookie,
			'query ($name: String!) { skillDetail(name: $name) { description body hash } }',
			{ name: DRAFT.name },
		);
		expect(detail.body.data.skillDetail).toMatchObject({ description: DRAFT.description, body: DRAFT.body });

		const updated = await graphql(
			contextAdminCookie,
			'mutation ($input: UpdateSkillInput!) { updateSkill(input: $input) { hash } }',
			{ input: { ...DRAFT, body: 'New body', expectedHash: detail.body.data.skillDetail.hash } },
		);
		expect(updated.body.errors).toBeUndefined();

		const deleted = await graphql(
			contextAdminCookie,
			'mutation ($input: DeleteSkillInput!) { deleteSkill(input: $input) }',
			{ input: { name: DRAFT.name, expectedHash: updated.body.data.updateSkill.hash } },
		);
		expect(deleted.body.data.deleteSkill).toBe(true);
		expect(existsSync(path.join(projectPath, 'agent', 'skills', `${DRAFT.name}.md`))).toBe(false);
	});

	it('shows a draft from chat without saving anything, then stops', async () => {
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', adminCookie)
			.set('x-loopwise-project-id', projectId)
			.send({ message: { text: 'Make this a skill' }, model: MODEL })
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			})
			.expect(200);

		const events = (res.body as string)
			.split('\n')
			.filter((line) => line.startsWith('data: {'))
			.map((line) => JSON.parse(line.slice('data: '.length)));
		const output = events.find((event) => event.type === 'tool-output-available');
		expect(output?.output).toMatchObject({ success: true });
		expect(events.some((event) => event.type === 'text-delta')).toBe(false);
		expect(existsSync(path.join(projectPath, 'agent', 'skills', `${DRAFT.name}.md`))).toBe(false);
	});
});

/** Calls `propose_skill` on every step, so a second step would show the run didn't stop at the draft. */
function scriptedModel(): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Churn skill' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async () => ({
			stream: new ReadableStream<LanguageModelV3StreamPart>({
				start(controller) {
					controller.enqueue({ type: 'stream-start', warnings: [] });
					controller.enqueue({
						type: 'tool-call',
						toolCallId: 'call_skill',
						toolName: 'propose_skill',
						input: JSON.stringify(DRAFT),
					});
					controller.enqueue({
						type: 'finish',
						finishReason: { unified: 'tool-calls', raw: 'tool_use' },
						usage,
					});
					controller.close();
				},
			}),
		}),
	});
	return { model, providerOptions: {}, contextWindow: 128_000 } as unknown as ProviderModelResult;
}
