import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { seedPathways } from '../prisma/seed-pathways.js';
import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { RulesService } from '../src/clinical/pathways/rules.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };

interface ScriptedCall {
	toolName: string;
	input: Record<string, unknown>;
}

/**
 * Wise's `explain_result` (DESIGN.md §2, §9.2): it relays the rules engine's deterministic evaluation, read as the
 * user, so a doctor at another facility gets nothing, and every read is audited. The LLM is scripted.
 */
describe('explain_result (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let labId = '';
	const script: ScriptedCall[][] = [];
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
	};

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', cookie)
			.set(clinicId ? { 'x-loopwise-clinic-id': clinicId } : {})
			.send({ query, variables });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SSE events of every type
	const ask = async (cookie: string[], steps: ScriptedCall[]): Promise<any[]> => {
		script.push(...steps.map((step) => [step]), []);
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', cookie)
			.set('x-loopwise-clinic-id', clinicId)
			.send({ model: MODEL, message: { text: 'Why is this HbA1c flagged?' } })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});
		expect(res.status).toBe(200);
		return parseSse(res.body as string);
	};

	const createResult = (code: string, value: string, unit: string | null, flag: 'high' | 'critical_high') =>
		prisma.result.create({
			data: {
				patientId,
				sourceOrgId: labId,
				code,
				display: code === '4548-4' ? 'Hemoglobin A1c' : 'Potassium',
				value,
				valueNumeric: Number(value),
				unit,
				flag,
				resultedAt: new Date(),
			},
		});

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		await seedPathways(prisma as unknown as Prisma.TransactionClient);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		users.reyes = { cookie: reyes.cookie, id: reyes.userId };
		users.cruz = { cookie: cruz.cookie, id: cruz.userId };

		const clinic = await graphql(users.reyes.cookie, 'mutation { createClinic(input: { name: "Clinic" }) { id } }');
		clinicId = clinic.body.data.createClinic.id;
		await prisma.clinicMember.createMany({
			data: [{ clinicId, userId: users.cruz.id, role: 'user' }],
			skipDuplicates: true,
		});

		const healthCenter = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		const hospital = await prisma.organization.create({ data: { name: 'Hospital', slug: 'rh', type: 'hospital' } });
		labId = (await prisma.organization.create({ data: { name: 'Lab', slug: 'lab', type: 'lab' } })).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: healthCenter.id, userId: users.reyes.id, role: 'user' },
				{ orgId: hospital.id, userId: users.cruz.id, role: 'user' },
			],
		});
		patientId = (
			await prisma.patient.create({
				data: {
					givenName: 'Maria',
					familyName: 'Santos',
					birthDate: new Date('1981-04-12'),
					sex: 'female',
					consentAt: new Date(),
					careRelationships: {
						create: { userId: users.reyes.id, orgId: healthCenter.id, reason: 'encounter' },
					},
				},
			})
		).id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('relays the stored evaluation, read as the doctor and audited', async () => {
		const result = await createResult('4548-4', '12.1', '%', 'critical_high');
		await app.get(RulesService).evaluateAndStore(result.id);

		const events = await ask(users.reyes.cookie, [{ toolName: 'explain_result', input: { resultId: result.id } }]);
		const output = events.find((event) => event.type === 'tool-output-available')?.output;
		expect(output).toMatchObject({
			result: {
				id: result.id,
				patientId,
				display: 'Hemoglobin A1c',
				value: '12.1',
				unit: '%',
				flag: 'critical_high',
			},
			evaluation: {
				pathwayKey: 'diabetes',
				pathwayName: 'Diabetes (HbA1c / fasting glucose)',
				ruleVersion: 2,
				classification: 'critical',
				urgency: 'critical',
				nextState: 'escalated',
				basis: 'band',
				rule: { band: '≥ 12 %', comparedValue: 12.1 },
				stored: true,
			},
		});
		expect(output.evaluation.reason).toContain('critical value');
		const audit = await prisma.auditLog.findMany({
			where: { userId: users.reyes.id, action: 'result_evaluation.view', resourceId: result.id },
		});
		expect(audit).toMatchObject([{ patientId, reason: 'Wise explain_result' }]);
	});

	it('computes the evaluation with the same engine when none is stored yet', async () => {
		const result = await createResult('2823-3', '5.0', 'mmol/L', 'critical_high');
		const events = await ask(users.reyes.cookie, [{ toolName: 'explain_result', input: { resultId: result.id } }]);
		const output = events.find((event) => event.type === 'tool-output-available')?.output;
		expect(output.evaluation).toMatchObject({
			pathwayKey: 'potassium',
			basis: 'critical_flag',
			urgency: 'urgent',
			nextState: 'escalated',
			stored: false,
		});
		expect(await prisma.resultEvaluation.count({ where: { resultId: result.id } })).toBe(0);
	});

	it('gives a doctor at another facility nothing, and audits nothing', async () => {
		const result = await createResult('4548-4', '7.2', '%', 'high');
		await app.get(RulesService).evaluateAndStore(result.id);

		const events = await ask(users.cruz.cookie, [{ toolName: 'explain_result', input: { resultId: result.id } }]);
		expect(events.find((event) => event.type === 'tool-output-available')).toBeUndefined();
		expect(events.find((event) => event.type === 'tool-output-error')?.errorText).toMatch(
			/No result with this id that you may see/,
		);
		expect(await prisma.auditLog.count({ where: { userId: users.cruz.id, patientId } })).toBe(0);
	});
});

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
