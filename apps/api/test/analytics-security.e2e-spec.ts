import crypto from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { getMetric } from '@loopwise/shared/tools';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { LlmService } from '../src/agent/llm/llm.service.js';
import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { AnalyticsRepository } from '../src/clinical/analytics/analytics.repository.js';
import { type AnalyticsOrigin, AnalyticsService } from '../src/clinical/analytics/analytics.service.js';
import { closeBrowser, hasChrome } from '../src/clinical/insights/report-pdf/headless-browser.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const origin = (toolCallId = crypto.randomUUID()): AnalyticsOrigin => ({ chatId: 'c', toolCallId, tool: 'test' });

/**
 * Safe analytics (DESIGN.md §8.2), checked twice for every attack: the validator refuses it, and Postgres refuses it
 * too when the validator is bypassed (`AnalyticsRepository.runWithToken`, the analyst side of a run). Dr. A works at
 * the health center and cares for Maria; Dr. B works at another clinic and cares for Juan.
 */
describe('analytics security (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let service: AnalyticsService;
	let repository: AnalyticsRepository;
	let projectId = '';
	let maria = '';
	let juan = '';
	const users = { a: { cookie: [] as string[], id: '' }, b: { cookie: [] as string[], id: '' } };
	const script: { toolName: string; input: Record<string, unknown>; toolCallId?: string }[][] = [];

	/** The analyst side of a run, for `userId`, past the validator: what Postgres alone allows. */
	const raw = async (userId: string, sql: string) => {
		const token = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(token, userId);
		try {
			return await repository.runWithToken(token, sql);
		} finally {
			await repository.revokeGrant(token);
		}
	};
	const rawError = (userId: string, sql: string) =>
		raw(userId, sql).then(
			() => 'ran',
			(error: Error) => error.message,
		);
	const refused = (userId: string, sql: string) =>
		service.run(userId, { sql, purpose: 'test' }, origin()).then(
			() => 'ran',
			(error: Error) => error.message,
		);
	const count = async (userId: string, sql: string) => (await raw(userId, sql)).rows[0][0];

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_PROJECTS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-projects-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		service = app.get(AnalyticsService, { strict: false });
		repository = app.get(AnalyticsRepository, { strict: false });
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		const password = 'Sup3r-secret!';
		const a = await createTestUser(app, { name: 'Dr. A', email: 'a@example.com', password });
		const b = await createTestUser(app, { name: 'Dr. B', email: 'b@example.com', password });
		users.a = { cookie: a.cookie, id: a.userId };
		users.b = { cookie: b.cookie, id: b.userId };
		const project = await request(app.getHttpServer())
			.post('/graphql')
			.set('Cookie', users.a.cookie)
			.send({ query: 'mutation { createProject(input: { name: "Clinic" }) { id } }' });
		projectId = project.body.data.createProject.id;

		const healthCenter = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		const other = await prisma.organization.create({ data: { name: 'Other Clinic', slug: 'oc', type: 'clinic' } });
		await prisma.orgMember.createMany({
			data: [
				{ orgId: healthCenter.id, userId: users.a.id, role: 'user' },
				{ orgId: other.id, userId: users.b.id, role: 'user' },
			],
		});
		const patient = async (givenName: string, doctor: string, orgId: string) => {
			const created = await prisma.patient.create({
				data: {
					givenName,
					familyName: 'Synthetic',
					birthDate: new Date('1980-01-01'),
					sex: 'female',
					barangay: 'Cogon',
					careRelationships: { create: [{ userId: doctor, orgId, reason: 'encounter' }] },
				},
			});
			await prisma.encounter.create({
				data: { patientId: created.id, doctorId: doctor, orgId, reason: 'Check-up', startedAt: new Date() },
			});
			return created.id;
		};
		maria = await patient('Maria', users.a.id, healthCenter.id);
		juan = await patient('Juan', users.b.id, other.id);
	});

	afterAll(async () => {
		await closeBrowser();
		await app?.close();
	});

	it("reaches only the user's own patients, through every view, join and CTE", async () => {
		const panel = await service.metric(users.a.id, { metric: 'panel_size' }, origin());
		expect(panel.rows).toEqual([[1]]);
		const own = await service.run(
			users.b.id,
			{ sql: 'SELECT patient_id, name FROM patients', purpose: 'list' },
			origin(),
		);
		expect(own.rows).toEqual([[juan, 'Juan Synthetic']]);

		for (const sql of [
			`SELECT count(*) FROM patients WHERE patient_id = '${maria}'`,
			`SELECT count(*) FROM encounters e JOIN patients p USING (patient_id) WHERE p.name LIKE 'Maria%'`,
			`WITH x AS (SELECT * FROM encounters) SELECT count(*) FROM x WHERE patient_id = '${maria}'`,
			`SELECT count(*) FROM diagnoses WHERE patient_id IN (SELECT patient_id FROM encounters WHERE patient_id = '${maria}')`,
		]) {
			expect((await service.run(users.b.id, { sql, purpose: 'probe' }, origin())).rows, sql).toEqual([[0]]);
			expect(await count(users.b.id, sql), sql).toBe(0);
		}
	});

	it('cannot impersonate another user or switch role', async () => {
		const forge = `SELECT set_config('app.user_id', '${users.a.id}', true), (SELECT count(*) FROM patients WHERE patient_id = '${maria}')`;
		expect(await refused(users.b.id, forge)).toMatch(/Function set_config\(\) is not allowed/);
		expect((await raw(users.b.id, forge)).rows[0][1]).toBe(0);

		expect(await refused(users.b.id, "SELECT set_config('role', 'loopwise', true)")).toMatch(/not allowed/);
		expect(await rawError(users.b.id, "SELECT set_config('role', 'loopwise', true)")).toMatch(/permission denied/);
		expect(await rawError(users.b.id, 'SET ROLE loopwise')).toMatch(/permission denied/);
		expect(await refused(users.b.id, 'RESET ROLE')).toMatch(/Only SELECT/);
	});

	it('sees nothing without a bound identity, and a token works once, for a short time', async () => {
		expect((await repository.runWithToken(null, 'SELECT count(*) FROM patients')).rows).toEqual([[0]]);
		const forged = `SELECT set_config('app.user_id', '${users.a.id}', true), (SELECT count(*) FROM patients)`;
		expect((await repository.runWithToken(null, forged)).rows[0][1]).toBe(0);

		const token = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(token, users.a.id);
		expect((await repository.runWithToken(token, 'SELECT count(*) FROM patients')).rows).toEqual([[1]]);
		await expect(repository.runWithToken(token, 'SELECT count(*) FROM patients')).rejects.toThrow(
			/invalid or expired analytics token/,
		);

		const stale = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(stale, users.a.id, -1);
		await expect(repository.runWithToken(stale, 'SELECT 1')).rejects.toThrow(/invalid or expired/);
		const fresh = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(fresh, users.b.id);
		await expect(repository.runWithToken(fresh, "SELECT analytics.bind('another token')")).rejects.toThrow(
			/already bound/,
		);
	});

	it('refuses writes and DDL, in the validator and in Postgres', async () => {
		for (const [sql, database] of [
			[`INSERT INTO patients (patient_id) VALUES ('x')`, /read-only|permission denied/],
			[`UPDATE patients SET barangay = 'x'`, /read-only|permission denied/],
			[`DELETE FROM public.patient`, /read-only|permission denied/],
			['CREATE TABLE analytics.x (a int)', /read-only|permission denied/],
			['DROP VIEW analytics.patients', /read-only|must be owner|permission denied/],
			["COPY (SELECT 1) TO '/tmp/x'", /read-only|permission denied|not allowed/],
			[
				`WITH d AS (DELETE FROM public.patient RETURNING id) SELECT count(*) FROM d`,
				/read-only|permission denied/,
			],
		] as const) {
			expect(await refused(users.a.id, sql), sql).toMatch(/Query refused/);
			expect(await rawError(users.a.id, sql), sql).toMatch(database);
		}
		expect(await prisma.patient.count()).toBe(2);
	});

	it('refuses base tables, catalogs and other schemas', async () => {
		for (const sql of [
			'SELECT count(*) FROM public.patient',
			'SELECT count(*) FROM patient',
			'SELECT * FROM "user"',
			'SELECT * FROM app_private.analytics_grant',
			'SELECT * FROM audit_log',
		]) {
			expect(await refused(users.a.id, sql), sql).toMatch(/Query refused/);
			expect(await rawError(users.a.id, sql), sql).toMatch(/permission denied|does not exist/);
		}
		for (const sql of [
			'SELECT relname FROM pg_catalog.pg_class',
			'SELECT * FROM pg_stat_activity',
			'SELECT * FROM information_schema.tables',
			"SELECT pg_read_file('/etc/passwd')",
			"SELECT 'patient'::regclass",
			'SELECT ctid FROM patients',
		]) {
			expect(await refused(users.a.id, sql), sql).toMatch(/Query refused/);
		}
		// Postgres keeps the catalogs readable (metadata, no patient data) but not other sessions' SQL or files.
		expect(await rawError(users.a.id, 'SELECT query FROM pg_catalog.pg_stat_activity')).toMatch(
			/permission denied/,
		);
		expect(await rawError(users.a.id, "SELECT pg_read_file('/etc/passwd')")).toMatch(/permission denied/);
	});

	it('refuses several statements and stops long queries', async () => {
		expect(await refused(users.a.id, 'SELECT 1; DELETE FROM patients')).toMatch(/exactly one SELECT/);
		expect(await rawError(users.a.id, 'SELECT 1; SELECT 2')).toMatch(/multiple commands/);

		expect(await refused(users.a.id, 'SELECT pg_sleep(10)')).toMatch(/pg_sleep\(\) is not allowed/);
		expect(await rawError(users.a.id, 'SELECT pg_sleep(10)')).toMatch(/statement timeout/);
		expect(await refused(users.a.id, 'SELECT count(*) FROM generate_series(1, 2000000000)')).toMatch(
			/longer than 5 seconds/,
		);
	}, 30_000);

	it('runs every certified metric for a doctor', async () => {
		for (const metric of getMetric.METRICS) {
			const result = await service.metric(users.a.id, { metric, months: 12 }, origin());
			expect(result.columns.length, metric).toBeGreaterThan(0);
		}
		const byAge = await service.metric(users.a.id, { metric: 'patients_by_age_band' }, origin());
		expect(byAge.rows).toEqual([['40-59', 1]]);
	});

	it("draws a metric with its own chart, and a query's chart only from its own columns", async () => {
		const byAge = await service.metric(users.a.id, { metric: 'patients_by_age_band' }, origin());
		expect(byAge.chart).toEqual({ type: 'bar', x: 'age_band', y: ['patients'] });
		const table = await service.metric(users.a.id, { metric: 'patients_by_age_band', chart: 'none' }, origin());
		expect(table.chart).toBeNull();
		expect(await service.metric(users.a.id, { metric: 'panel_size' }, origin())).toMatchObject({ chart: null });

		const sql = 'SELECT sex, count(*)::int AS patients FROM patients GROUP BY sex';
		const pie = await service.run(
			users.a.id,
			{ sql, purpose: 'by sex', chart: { type: 'pie', x: 'sex', y: ['patients'] } },
			origin(),
		);
		expect(pie.chart).toEqual({ type: 'pie', x: 'sex', y: ['patients'] });
		await expect(
			service.run(users.a.id, { sql, purpose: 'x', chart: { type: 'bar', x: 'sex', y: ['visits'] } }, origin()),
		).rejects.toThrow(/Chart columns visits are not in the result/);
	});

	it('audits every query: the SQL, the row count and the patients returned, and refusals', async () => {
		const toolCallId = crypto.randomUUID();
		await service.run(
			users.a.id,
			{ sql: 'SELECT patient_id, name FROM patients', purpose: 'my panel' },
			origin(toolCallId),
		);
		const [row] = await prisma.auditLog.findMany({ where: { resourceId: toolCallId } });
		expect(row).toMatchObject({
			userId: users.a.id,
			action: 'analytics.query',
			resource: 'analytics',
			reason: 'my panel',
			origin: {
				source: 'wise',
				tool: 'test',
				sql: 'SELECT patient_id, name FROM patients',
				rowCount: 1,
				scope: 'patients',
				patientIds: [maria],
			},
		});
		const refusedId = crypto.randomUUID();
		await service.run(users.a.id, { sql: 'DELETE FROM patients', purpose: 'x' }, origin(refusedId)).catch(() => {});
		expect(await prisma.auditLog.findFirst({ where: { resourceId: refusedId } })).toMatchObject({
			action: 'analytics.rejected',
			origin: { sql: 'DELETE FROM patients' },
		});
	});

	it('answers "how many patients do I have" through the Wise tools, audited with the chat', async () => {
		script.push(
			[{ toolName: 'get_metric', input: { metric: 'panel_size' } }],
			[
				{
					toolName: 'run_analytics_sql',
					input: { sql: 'SELECT age_band, count(*) AS patients FROM patients GROUP BY 1', purpose: 'by age' },
				},
			],
			[],
		);
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', users.a.cookie)
			.set('x-loopwise-project-id', projectId)
			.send({ model: MODEL, message: { text: 'How many patients do I have, by age group?' } })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});
		const outputs = parseSse(res.body as string)
			.filter((event) => event.type === 'tool-output-available')
			.map((event) => event.output);
		expect(outputs).toMatchObject([
			{ metric: 'panel_size', columns: ['patients'], rows: [[1]] },
			{ columns: ['age_band', 'patients'], rows: [['40-59', 1]], rowCount: 1, truncated: false },
		]);
		const audited = await prisma.auditLog.findMany({
			where: {
				userId: users.a.id,
				action: 'analytics.query',
				origin: { path: ['tool'], equals: 'run_analytics_sql' },
			},
		});
		expect(audited).toHaveLength(1);
		expect(audited[0].origin).toMatchObject({ scope: 'aggregate', rowCount: 1 });
	});

	it('builds a side-panel report from a metric of the same turn, and prints it for its owner only', async () => {
		const metricId = `metric_${crypto.randomUUID()}`;
		const reportId = `report_${crypto.randomUUID()}`;
		script.push(
			[{ toolName: 'get_metric', input: { metric: 'patients_by_age_band' }, toolCallId: metricId }],
			[
				{
					toolName: 'report',
					toolCallId: reportId,
					input: {
						action: 'create',
						id: 'panel',
						title: 'My panel',
						code: `# My panel\n1 patient, aged 40-59.\n<chart ref="${metricId}"/>`,
					},
				},
			],
			[],
		);
		const res = await request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', users.a.cookie)
			.set('x-loopwise-project-id', projectId)
			.send({ model: MODEL, message: { text: 'Make a report of my panel' } })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});
		const report = parseSse(res.body as string).find(
			(event) => event.type === 'tool-output-available' && event.toolCallId === reportId,
		)?.output;
		expect(report).toMatchObject({ id: 'panel', version: 1, action: 'create', refs: [metricId], patientId: null });

		const part = await prisma.messagePart.findFirstOrThrow({
			where: { toolCallId: reportId },
			select: { chatMessage: { select: { chatId: true } } },
		});
		const exportPdf = (cookie: string[]) =>
			request(app.getHttpServer())
				.post('/graphql')
				.set('Cookie', cookie)
				.send({
					query: 'mutation ($c: ID!, $t: String!) { exportWiseReportPdf(chatId: $c, toolCallId: $t) { filename data } }',
					variables: { c: part.chatMessage.chatId, t: reportId },
				});
		expect((await exportPdf(users.b.cookie)).body.errors?.[0]?.message).toBe('Report not found.');
		if (!hasChrome()) {
			return;
		}
		const pdf = (await exportPdf(users.a.cookie)).body.data.exportWiseReportPdf;
		expect(pdf.filename).toMatch(/^panel-v1-\d{4}-\d{2}-\d{2}\.pdf$/);
		expect(Buffer.from(pdf.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
		expect(await prisma.auditLog.count({ where: { action: 'report.export', resourceId: reportId } })).toBe(1);
	}, 60_000);
});

/** Each stream call takes the next scripted step: its tool calls, or (when empty) a short answer. */
function scriptedModel(
	script: { toolName: string; input: Record<string, unknown>; toolCallId?: string }[][],
): ProviderModelResult {
	const usage = {
		inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
		outputTokens: { total: 1, text: 1, reasoning: 0 },
	};
	let callId = 0;
	const model = new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text: 'Analytics' }],
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
								toolCallId: call.toolCallId ?? `analytics_${++callId}`,
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
