import crypto from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { LanguageModelV3StreamPart } from '@ai-sdk/provider';
import { getMetric } from '@loopwise/shared/tools';
import { Global, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MockLanguageModelV3 } from 'ai/test';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ProviderModelResult } from '../src/agent/providers/providers.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AnalyticsModule } from '../src/clinical/analytics/analytics.module.js';
import { AnalyticsRepository } from '../src/clinical/analytics/analytics.repository.js';
import { type AnalyticsOrigin, AnalyticsService } from '../src/clinical/analytics/analytics.service.js';
import { ANALYTICS_VIEWS } from '../src/clinical/analytics/sql-validator.js';
import { ConfigModule } from '../src/config/config.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createEncounter,
	createOrganization,
	createPatient,
	createUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const origin = (toolCallId = crypto.randomUUID()): AnalyticsOrigin => ({ chatId: 'c', toolCallId, tool: 'test' });

/** The guards module (an import of AnalyticsModule) needs an `AuthService`; the service is called directly here. */
@Global()
@Module({ providers: [{ provide: AuthService, useValue: {} }], exports: [AuthService] })
class StubAuthModule {}

@Module({ imports: [ConfigModule, PrismaModule, StubAuthModule, AnalyticsModule] })
class AnalyticsTestModule {}

interface AnalyticsScene {
	scene: ClinicScene;
	/** Dr. A: the scene's doctor, caring for Maria at the health center. */
	a: string;
	/** Dr. B: another organization's doctor, caring for Juan. */
	b: string;
	cashier: string;
	/** Only the VIEWER role at the health center, with a (synthetic) care relationship to Maria. */
	viewer: string;
	maria: string;
	juan: string;
}

/**
 * Two organizations: the scene's health center (Dr. A cares for Maria; a cashier; a viewer) and another one where
 * Dr. B cares for Juan. Each visit has an invoice.
 */
async function createAnalyticsScene(prisma: PrismaService): Promise<AnalyticsScene> {
	const scene = await createClinicScene(prisma);
	await prisma.patient.update({
		where: { id: scene.patient.id },
		data: { birthDate: new Date('1980-01-01T00:00:00Z') },
	});
	const cashier = await createUser(prisma, { firstName: 'Carla', lastName: 'Cashier' });
	await grantClinicRoles(prisma, scene.clinic.id, cashier.id, ['CASHIER']);
	const viewer = await createUser(prisma, { firstName: 'Vic', lastName: 'Viewer' });
	await grantClinicRoles(prisma, scene.clinic.id, viewer.id, ['VIEWER']);
	await prisma.careRelationship.create({
		data: {
			patientId: scene.patient.id,
			userId: viewer.id,
			organizationId: scene.organization.id,
			reason: 'ENCOUNTER',
		},
	});

	const b = await createUser(prisma, { firstName: 'Bea', lastName: 'Bautista' });
	const other = await createOrganization(prisma, { members: [{ userId: b.id, role: 'MEMBER' }] });
	const otherClinic = await createClinic(prisma, {
		organizationId: other.id,
		staff: [{ userId: b.id, roles: ['DOCTOR'] }],
	});
	const juan = await createPatient(prisma, {
		organizationId: other.id,
		firstName: 'Juan',
		lastName: 'Synthetic',
		careTeam: [b.id],
	});
	const juanVisit = await createEncounter(prisma, { clinicId: otherClinic.id, patientId: juan.id });

	const invoice = (clinicId: string, encounterId: string, net: number) =>
		prisma.invoice.create({
			data: { clinicId, encounterId, buyerName: 'Synthetic', grossAmount: net, netAmount: net, balance: net },
		});
	await invoice(scene.clinic.id, scene.encounter.id, 380);
	await invoice(otherClinic.id, juanVisit.id, 500);
	return {
		scene,
		a: scene.doctor.id,
		b: b.id,
		cashier: cashier.id,
		viewer: viewer.id,
		maria: scene.patient.id,
		juan: juan.id,
	};
}

/**
 * Safe analytics (DESIGN.md §8.2), checked twice for every attack: the validator refuses it, and Postgres refuses it
 * too when the validator is bypassed (`AnalyticsRepository.runWithToken`, the analyst side of a run).
 */
describe('analytics security (e2e)', () => {
	let prisma: PrismaService;
	let service: AnalyticsService;
	let repository: AnalyticsRepository;
	let s: AnalyticsScene;

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
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [AnalyticsTestModule] }).compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		prisma = app.get(PrismaService);
		service = app.get(AnalyticsService);
		repository = app.get(AnalyticsRepository);
		s = await createAnalyticsScene(prisma);
	});

	afterAll(async () => {
		await prisma?.$disconnect();
	});

	it('describes exactly the views the validator allows', async () => {
		const described = await service.describe();
		expect(described.views.map((view) => view.name).sort()).toEqual([...ANALYTICS_VIEWS].sort());
		expect(described.metrics.map((metric) => metric.name)).toEqual([...getMetric.METRICS]);
	});

	it("reaches only the user's own patients, through every view, join and CTE", async () => {
		const panel = await service.metric(s.a, { metric: 'panel_size' }, origin());
		expect(panel.rows).toEqual([[1]]);
		const own = await service.run(s.b, { sql: 'SELECT patient_id, name FROM patients', purpose: 'list' }, origin());
		expect(own.rows).toEqual([[s.juan, 'Juan Synthetic']]);

		for (const sql of [
			`SELECT count(*) FROM patients WHERE patient_id = '${s.maria}'`,
			`SELECT count(*) FROM encounters e JOIN patients p USING (patient_id) WHERE p.name LIKE 'Maria%'`,
			`WITH x AS (SELECT * FROM encounters) SELECT count(*) FROM x WHERE patient_id = '${s.maria}'`,
			`SELECT count(*) FROM diagnoses WHERE patient_id IN (SELECT patient_id FROM encounters WHERE patient_id = '${s.maria}')`,
			`SELECT count(*) FROM invoices WHERE patient_id = '${s.maria}'`,
		]) {
			expect((await service.run(s.b, { sql, purpose: 'probe' }, origin())).rows, sql).toEqual([[0]]);
			expect(await count(s.b, sql), sql).toBe(0);
		}
	});

	it("shows a visit's invoice only to who may see its patient: the doctor, the clinic's cashier", async () => {
		const sql = 'SELECT count(*)::int, coalesce(sum(net_amount), 0)::float8 FROM invoices';
		expect((await raw(s.a, sql)).rows).toEqual([[1, 380]]);
		expect((await raw(s.cashier, sql)).rows).toEqual([[1, 380]]);
		expect((await raw(s.b, sql)).rows).toEqual([[1, 500]]);
		// Same clinic, no care relationship: the invoices table lets clinic staff read it, the view does not.
		expect((await raw(s.scene.otherDoctor.id, sql)).rows).toEqual([[0, 0]]);
		expect(await count(s.scene.otherDoctor.id, 'SELECT count(*) FROM invoice_lines')).toBe(0);
	});

	it('cannot impersonate another user or switch role', async () => {
		const forge = `SELECT set_config('app.user_id', '${s.a}', true), (SELECT count(*) FROM patients WHERE patient_id = '${s.maria}')`;
		expect(await refused(s.b, forge)).toMatch(/Function set_config\(\) is not allowed/);
		expect((await raw(s.b, forge)).rows[0][1]).toBe(0);

		expect(await refused(s.b, "SELECT set_config('role', 'loopwise', true)")).toMatch(/not allowed/);
		expect(await rawError(s.b, "SELECT set_config('role', 'loopwise', true)")).toMatch(/permission denied/);
		expect(await rawError(s.b, 'SET ROLE loopwise')).toMatch(/permission denied/);
		expect(await refused(s.b, 'RESET ROLE')).toMatch(/Only SELECT/);
	});

	it('sees nothing without a bound identity, and a token works once, for a short time', async () => {
		expect((await repository.runWithToken(null, 'SELECT count(*) FROM patients')).rows).toEqual([[0]]);
		const forged = `SELECT set_config('app.user_id', '${s.a}', true), (SELECT count(*) FROM patients)`;
		expect((await repository.runWithToken(null, forged)).rows[0][1]).toBe(0);

		const token = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(token, s.a);
		expect((await repository.runWithToken(token, 'SELECT count(*) FROM patients')).rows).toEqual([[1]]);
		await expect(repository.runWithToken(token, 'SELECT count(*) FROM patients')).rejects.toThrow(
			/invalid or expired analytics token/,
		);

		const stale = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(stale, s.a, -1);
		await expect(repository.runWithToken(stale, 'SELECT 1')).rejects.toThrow(/invalid or expired/);
		const fresh = crypto.randomBytes(32).toString('hex');
		await repository.issueGrant(fresh, s.b);
		await expect(repository.runWithToken(fresh, "SELECT analytics.bind('another token')")).rejects.toThrow(
			/already bound/,
		);
	});

	it('refuses writes and DDL, in the validator and in Postgres', async () => {
		for (const [sql, database] of [
			[`INSERT INTO patients (patient_id) VALUES ('${crypto.randomUUID()}')`, /read-only|permission denied/],
			[`UPDATE patients SET preferred_language = 'x'`, /read-only|permission denied/],
			[`UPDATE invoices SET net_amount = 0`, /read-only|permission denied|cannot update view/],
			[`DELETE FROM public.patients`, /read-only|permission denied/],
			['CREATE TABLE analytics.x (a int)', /read-only|permission denied/],
			['DROP VIEW analytics.patients', /read-only|must be owner|permission denied/],
			["COPY (SELECT 1) TO '/tmp/x'", /read-only|permission denied|not allowed/],
			[
				`WITH d AS (DELETE FROM public.patients RETURNING id) SELECT count(*) FROM d`,
				/read-only|permission denied/,
			],
		] as const) {
			expect(await refused(s.a, sql), sql).toMatch(/Query refused/);
			expect(await rawError(s.a, sql), sql).toMatch(database);
		}
		expect(await prisma.patient.count()).toBe(2);
		expect(await prisma.invoice.count({ where: { netAmount: 0 } })).toBe(0);
	});

	it('refuses base tables, catalogs and other schemas', async () => {
		for (const sql of [
			'SELECT count(*) FROM public.patients',
			'SELECT count(*) FROM public.invoices',
			'SELECT count(*) FROM payments',
			'SELECT * FROM "users"',
			'SELECT * FROM app_private.analytics_grant',
			'SELECT * FROM audit_logs',
		]) {
			expect(await refused(s.a, sql), sql).toMatch(/Query refused/);
			expect(await rawError(s.a, sql), sql).toMatch(/permission denied|does not exist/);
		}
		for (const sql of [
			'SELECT relname FROM pg_catalog.pg_class',
			'SELECT * FROM pg_stat_activity',
			'SELECT * FROM information_schema.tables',
			"SELECT pg_read_file('/etc/passwd')",
			"SELECT 'patients'::regclass",
			'SELECT ctid FROM patients',
		]) {
			expect(await refused(s.a, sql), sql).toMatch(/Query refused/);
		}
		// Postgres keeps the catalogs readable (metadata, no patient data) but not other sessions' SQL or files.
		expect(await rawError(s.a, 'SELECT query FROM pg_catalog.pg_stat_activity')).toMatch(/permission denied/);
		expect(await rawError(s.a, "SELECT pg_read_file('/etc/passwd')")).toMatch(/permission denied/);
	});

	it('refuses several statements and stops long queries', async () => {
		expect(await refused(s.a, 'SELECT 1; DELETE FROM patients')).toMatch(/exactly one SELECT/);
		expect(await rawError(s.a, 'SELECT 1; SELECT 2')).toMatch(/multiple commands/);

		expect(await refused(s.a, 'SELECT pg_sleep(10)')).toMatch(/pg_sleep\(\) is not allowed/);
		expect(await rawError(s.a, 'SELECT pg_sleep(10)')).toMatch(/statement timeout/);
		expect(await refused(s.a, 'SELECT count(*) FROM generate_series(1, 2000000000)')).toMatch(
			/longer than 5 seconds/,
		);
	}, 30_000);

	it('runs every certified metric for a doctor', async () => {
		for (const metric of getMetric.METRICS) {
			const result = await service.metric(s.a, { metric, months: 12 }, origin());
			expect(result.columns.length, metric).toBeGreaterThan(0);
		}
		const byAge = await service.metric(s.a, { metric: 'patients_by_age_band' }, origin());
		expect(byAge.rows).toEqual([['40-59', 1]]);
		const billing = await service.metric(s.cashier, { metric: 'billing_totals' }, origin());
		expect(billing.columns).toEqual(['status', 'invoices', 'gross', 'discounts', 'net', 'paid', 'balance']);
		expect(billing.rows).toEqual([['draft', 1, 380, 0, 380, 0, 380]]);
	});

	it('suppresses small counts for viewer-only users, not for clinicians', async () => {
		const sql = 'SELECT sex, count(*)::int AS patients FROM patients GROUP BY sex';
		const viewer = await service.run(s.viewer, { sql, purpose: 'by sex' }, origin());
		expect(viewer).toMatchObject({ rows: [['female', '<5']], suppressed: true });
		const doctor = await service.run(s.a, { sql, purpose: 'by sex' }, origin());
		expect(doctor).toMatchObject({ rows: [['female', 1]], suppressed: false });
	});

	it("draws a metric with its own chart, and a query's chart only from its own columns", async () => {
		const byAge = await service.metric(s.a, { metric: 'patients_by_age_band' }, origin());
		expect(byAge.chart).toEqual({ type: 'bar', x: 'age_band', y: ['patients'] });
		const table = await service.metric(s.a, { metric: 'patients_by_age_band', chart: 'none' }, origin());
		expect(table.chart).toBeNull();
		expect(await service.metric(s.a, { metric: 'panel_size' }, origin())).toMatchObject({ chart: null });

		const sql = 'SELECT sex, count(*)::int AS patients FROM patients GROUP BY sex';
		const pie = await service.run(
			s.a,
			{ sql, purpose: 'by sex', chart: { type: 'pie', x: 'sex', y: ['patients'] } },
			origin(),
		);
		expect(pie.chart).toEqual({ type: 'pie', x: 'sex', y: ['patients'] });
		await expect(
			service.run(s.a, { sql, purpose: 'x', chart: { type: 'bar', x: 'sex', y: ['visits'] } }, origin()),
		).rejects.toThrow(/Chart columns visits are not in the result/);

		const bp = await service.run(
			s.a,
			{
				sql: 'SELECT age_band, count(*)::int AS patients FROM patients GROUP BY 1',
				purpose: 'x',
				chart: { type: 'bar', x: 'age_band', y: ['patients'], thresholds: ['bp'] },
			},
			origin(),
		);
		expect(bp.chart?.references?.map((reference) => reference.value)).toEqual([140, 90]);
	});

	it('audits every query: the SQL, the row count and the patients returned, and refusals and failures', async () => {
		const toolCallId = crypto.randomUUID();
		await service.run(
			s.a,
			{ sql: 'SELECT patient_id, name FROM patients', purpose: 'my panel' },
			origin(toolCallId),
		);
		const [row] = await prisma.auditLog.findMany({ where: { entityId: toolCallId } });
		expect(row).toMatchObject({
			userId: s.a,
			action: 'VIEW',
			event: 'analytics.query',
			entityType: 'AnalyticsQuery',
			reason: 'my panel',
			origin: {
				source: 'wise',
				tool: 'test',
				sql: 'SELECT patient_id, name FROM patients',
				rowCount: 1,
				scope: 'patients',
				patientIds: [s.maria],
			},
		});
		const refusedId = crypto.randomUUID();
		await service.run(s.a, { sql: 'DELETE FROM patients', purpose: 'x' }, origin(refusedId)).catch(() => {});
		expect(await prisma.auditLog.findFirst({ where: { entityId: refusedId } })).toMatchObject({
			event: 'analytics.query.rejected',
			origin: { sql: 'DELETE FROM patients' },
		});
		const failedId = crypto.randomUUID();
		await service.run(s.a, { sql: 'SELECT 1 / 0', purpose: 'x' }, origin(failedId)).catch(() => {});
		expect(await prisma.auditLog.findFirst({ where: { entityId: failedId } })).toMatchObject({
			event: 'analytics.query.failed',
			reason: expect.stringMatching(/division by zero/),
		});
	});
});

/**
 * Wise's own path: the tools in a chat turn, and a report built from them. Needs the whole app, loaded here (not at the
 * top of the file) so the security cases above run on their own module.
 */
describe('analytics through Wise (e2e)', () => {
	let app: NestExpressApplication;
	let signIn: typeof import('./test-app.js').signIn;
	let browser: typeof import('../src/clinical/insights/report-pdf/headless-browser.js') | undefined;
	let prisma: PrismaService;
	let s: AnalyticsScene;
	let cookie: string[] = [];
	const script: { toolName: string; input: Record<string, unknown>; toolCallId?: string }[][] = [];

	const agent = (text: string, as = cookie) =>
		request(app.getHttpServer())
			.post('/api/agent')
			.set('Cookie', as)
			.set('x-loopwise-clinic-id', s.scene.clinic.id)
			.send({ model: MODEL, message: { text } })
			.buffer(true)
			.parse((response, callback) => {
				let body = '';
				response.on('data', (chunk: Buffer) => (body += chunk.toString()));
				response.on('end', () => callback(null, body));
			});

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		const testApp = await import('./test-app.js');
		const { LlmService } = await import('../src/agent/llm/llm.service.js');
		browser = await import('../src/clinical/insights/report-pdf/headless-browser.js');
		signIn = testApp.signIn;
		app = await testApp.createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);
		s = await createAnalyticsScene(prisma);
		cookie = await signIn(app, s.scene.doctor);
	});

	afterAll(async () => {
		await browser?.closeBrowser();
		await app?.close();
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
		const res = await agent('How many patients do I have, by age group?');
		const outputs = parseSse(res.body as string)
			.filter((event) => event.type === 'tool-output-available')
			.map((event) => event.output);
		expect(outputs).toMatchObject([
			{ metric: 'panel_size', columns: ['patients'], rows: [[1]] },
			{ columns: ['age_band', 'patients'], rows: [['40-59', 1]], rowCount: 1, truncated: false },
		]);
		const audited = await prisma.auditLog.findMany({
			where: { userId: s.a, event: 'analytics.query', origin: { path: ['tool'], equals: 'run_analytics_sql' } },
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
		const res = await agent('Make a report of my panel');
		const report = parseSse(res.body as string).find(
			(event) => event.type === 'tool-output-available' && event.toolCallId === reportId,
		)?.output;
		expect(report).toMatchObject({ id: 'panel', version: 1, action: 'create', refs: [metricId], patientId: null });

		const part = await prisma.messagePart.findFirstOrThrow({
			where: { toolCallId: reportId },
			select: { message: { select: { chatId: true } } },
		});
		const exportPdf = (as: string[]) =>
			request(app.getHttpServer())
				.post('/graphql')
				.set('Cookie', as)
				.set('x-loopwise-clinic-id', s.scene.clinic.id)
				.send({
					query: 'mutation ($c: ID!, $t: String!) { exportWiseReportPdf(chatId: $c, toolCallId: $t) { filename data } }',
					variables: { c: part.message.chatId, t: reportId },
				});
		const other = await signIn(app, s.scene.otherDoctor);
		expect((await exportPdf(other)).body.errors?.[0]?.message).toBe('Report not found.');
		if (!browser?.hasChrome()) {
			return;
		}
		const pdf = (await exportPdf(cookie)).body.data.exportWiseReportPdf;
		expect(pdf.filename).toMatch(/^panel-v1-\d{4}-\d{2}-\d{2}\.pdf$/);
		expect(Buffer.from(pdf.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
		expect(await prisma.auditLog.count({ where: { event: 'report.export', entityId: reportId } })).toBe(1);
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
