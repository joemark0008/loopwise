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

interface ScriptedCall {
	toolName: string;
	input: Record<string, unknown>;
}

/**
 * Wise's navigation tools (DESIGN.md §9.2): `find_patient` searches as the user and `open_page` only opens a chart the
 * user may see, so a doctor at another facility can neither find nor open the patient. The LLM is scripted: each
 * question runs the queued tool calls, one step each, then answers.
 */
describe('navigation tools (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let projectId = '';
	let patientId = '';
	const script: ScriptedCall[][] = [];
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
	};

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(projectId ? { 'x-quarry-project-id': projectId } : {})
			.send({ query, variables });

	/** Asks Wise, running `steps` (one tool call per step), and returns the SSE events. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE events of every type
	const ask = async (cookie: string[], steps: ScriptedCall[]): Promise<any[]> => {
		script.push(...steps.map((step) => [step]), []);
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-quarry-project-id', projectId)
			.send({ model: MODEL, message: { text: "Open Maria Santos's record" } })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});
		expect(res.status).toBe(200);
		return parseSse(res.body as string);
	};

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.QUARRY_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'quarry-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		users.reyes = { cookie: reyes.cookie, id: reyes.userId };
		users.cruz = { cookie: cruz.cookie, id: cruz.userId };

		const project = await graphql(
			users.reyes.cookie,
			'mutation { createProject(input: { name: "Clinic" }) { id } }',
		);
		projectId = project.body.data.createProject.id;
		await prisma.projectMember.createMany({
			data: [{ projectId, userId: users.cruz.id, role: 'user' }],
			skipDuplicates: true,
		});

		const healthCenter = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		const hospital = await prisma.organization.create({
			data: { name: 'Regional Hospital', slug: 'rh', type: 'hospital' },
		});
		await prisma.orgMember.createMany({
			data: [
				{ orgId: healthCenter.id, userId: users.reyes.id, role: 'user' },
				{ orgId: hospital.id, userId: users.cruz.id, role: 'user' },
			],
		});

		const registered = await graphql(
			users.reyes.cookie,
			'mutation ($input: RegisterPatientInput!) { registerPatient(input: $input) { patient { id } } }',
			{
				input: {
					facilityId: healthCenter.id,
					givenName: 'Maria',
					familyName: 'Santos',
					birthDate: '1981-04-12',
					sex: 'female',
					mrn: 'THC-0001',
					consentGiven: true,
				},
			},
		);
		patientId = registered.body.data.registerPatient.patient.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it("finds and opens the chart of a patient in the user's care, and audits both", async () => {
		const events = await ask(users.reyes.cookie, [
			{ toolName: 'find_patient', input: { query: 'Maria Santos' } },
			{
				toolName: 'open_page',
				input: { page: 'patients.detail', params: { patientId }, userAskedToOpen: true },
			},
		]);
		const outputs = events.filter((event) => event.type === 'tool-output-available').map((event) => event.output);
		expect(outputs).toEqual([
			{
				_version: '1',
				patients: [
					{
						id: patientId,
						name: 'Maria Santos',
						birthDate: '1981-04-12',
						sex: 'female',
						identifiers: [{ system: 'MRN', value: 'THC-0001' }],
					},
				],
				truncated: false,
			},
			{
				_version: '1',
				key: 'patients.detail',
				params: { patientId },
				label: "Maria Santos's chart",
				autoNavigate: true,
			},
		]);
		const audit = await prisma.auditLog.findMany({
			where: { userId: users.reyes.id, patientId, action: 'patient.view' },
			select: { reason: true },
		});
		expect(audit.map((row) => row.reason).sort()).toEqual(['Wise find_patient', 'Wise open_page']);
	});

	it('neither finds nor opens the patient for a doctor at another facility', async () => {
		const events = await ask(users.cruz.cookie, [
			{ toolName: 'find_patient', input: { query: 'Maria Santos' } },
			{
				toolName: 'open_page',
				input: { page: 'patients.detail', params: { patientId }, userAskedToOpen: true },
			},
		]);
		const found = events.find((event) => event.type === 'tool-output-available');
		expect(found?.output).toEqual({ _version: '1', patients: [], truncated: false });
		const refused = events.find((event) => event.type === 'tool-output-error');
		expect(refused?.errorText).toMatch(/No patient the user may see/);
		expect(events.some((event) => event.output?.key === 'patients.detail')).toBe(false);
		expect(await prisma.auditLog.count({ where: { userId: users.cruz.id, patientId } })).toBe(0);
	});
});

/** Each stream call takes the next scripted step: its tool calls, or (when empty) a short answer. */
function scriptedModel(script: ScriptedCall[][]): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	let callId = 0;
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Maria Santos' }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		}),
		doStream: async () => {
			const calls = script.shift() ?? [];
			const parts: LanguageModelV3StreamPart[] =
				calls.length > 0
					? [
							...calls.map((call): LanguageModelV3StreamPart => ({
								type: 'tool-call',
								toolCallId: `call_${++callId}`,
								toolName: call.toolName,
								input: JSON.stringify(call.input),
							})),
							{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
						]
					: [
							{ type: 'text-start', id: 'text_1' },
							{ type: 'text-delta', id: 'text_1', delta: 'Done.' },
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
