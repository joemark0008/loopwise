import crypto from 'node:crypto';
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
import { InsightsService } from '../src/clinical/insights/insights.service.js';
import { closeBrowser, hasChrome } from '../src/clinical/insights/report-pdf/headless-browser.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinic, createClinicScene, createOrganization } from './fixtures/clinic-fixtures.js';
import { createTestApp, resetDatabase, signIn, useTestDatabase } from './test-app.js';

const MODEL = { provider: 'openai', modelId: 'gpt-4.1-mini' };
const DAY = 24 * 60 * 60 * 1000;

const EXPORT = `mutation ($chatId: ID!, $toolCallId: String!) {
	exportReportPdf(chatId: $chatId, toolCallId: $toolCallId) { filename mimeType data }
}`;

interface ScriptedCall {
	toolName: string;
	input: Record<string, unknown>;
	toolCallId?: string;
}

/**
 * Wise charts and summary reports (DESIGN.md §7.2): `chart_patient_trend` and `create_report` read as the user, so a
 * doctor without a care relationship gets neither; a narrative with a number the record lacks is refused; the PDF is
 * printed only for the chat's owner and audited as `report.export`. The LLM is scripted, one tool call a step.
 */
describe('charts and reports (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let clinicId = '';
	let patientId = '';
	let facilityId = '';
	let otherClinicId = '';
	let encounterId = '';
	let doctorName = '';
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
			.send({ model: MODEL, message: { text: "Show Maria's BP and make a summary PDF" } })
			.buffer(true)
			.parse((response, callback) => {
				let text = '';
				response.on('data', (chunk: Buffer) => (text += chunk.toString()));
				response.on('end', () => callback(null, text));
			});
		expect(res.status).toBe(200);
		return parseSse(res.body as string);
	};

	/** The stored `create_report` part of the user's latest report: its chat and (possibly remapped) call id. */
	const latestReport = async (userId: string) => {
		const part = await prisma.messagePart.findFirstOrThrow({
			where: { toolName: 'create_report', toolState: 'output-available', message: { chat: { userId } } },
			orderBy: { createdAt: 'desc' },
			select: { toolCallId: true, message: { select: { chatId: true } } },
		});
		return { chatId: part.message.chatId, toolCallId: part.toolCallId! };
	};

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		process.env.LOOPWISE_CLINICS_DIR = await mkdtemp(path.join(tmpdir(), 'loopwise-clinics-'));
		await resetDatabase(databaseUrl);
		app = await createTestApp();
		prisma = app.get(PrismaService);
		vi.spyOn(app.get(LlmService, { strict: false }), 'resolveProviderModel').mockImplementation(async () =>
			scriptedModel(script),
		);

		// Synthetic: Maria, in Dr. Reyes's care (not Dr. Cruz's), with three visits of vitals and two released HbA1c.
		const scene = await createClinicScene(prisma);
		clinicId = scene.clinic.id;
		facilityId = scene.clinic.id;
		await prisma.clinic.update({ where: { id: clinicId }, data: { path: process.env.LOOPWISE_CLINICS_DIR } });
		users.reyes = { cookie: await signIn(app, scene.doctor), id: scene.doctor.id };
		users.cruz = { cookie: await signIn(app, scene.otherDoctor), id: scene.otherDoctor.id };
		doctorName = scene.doctor.name;
		patientId = scene.patient.id;
		const elsewhere = await createOrganization(prisma);
		otherClinicId = (await createClinic(prisma, { organizationId: elsewhere.id })).id;

		const hba1c = await prisma.diagnosticTest.create({
			data: {
				organizationId: scene.organization.id,
				code: 'HBA1C',
				name: 'Hemoglobin A1c',
				category: 'LABORATORY',
				parameters: { create: [{ code: 'HBA1C', name: 'HbA1c', unit: '%', lisCode: '4548-4' }] },
			},
			include: { parameters: true },
		});
		const now = Date.now();
		const visits: string[] = [];
		for (const [index, [daysAgo, systolic, diastolic]] of (
			[
				[180, 132, 84],
				[90, 136, 86],
				[10, 140, 90],
			] as const
		).entries()) {
			const encounter = await prisma.encounter.create({
				data: {
					clinicId,
					patientId,
					practitionerId: scene.doctorPractitioner.id,
					encounterNo: `TEST-ENC-${index + 1}`,
					status: 'COMPLETED',
					chiefComplaint: 'BP check',
					startedAt: new Date(now - daysAgo * DAY),
				},
			});
			visits.push(encounter.id);
			encounterId = encounter.id;
			await prisma.vitalSigns.create({
				data: {
					encounterId: encounter.id,
					systolicBp: systolic,
					diastolicBp: diastolic,
					recordedAt: new Date(now - daysAgo * DAY),
					recordedById: users.reyes.id,
				},
			});
		}
		for (const [index, [daysAgo, value]] of (
			[
				[170, 6.1],
				[8, 7.2],
			] as const
		).entries()) {
			const at = new Date(now - daysAgo * DAY);
			await prisma.diagnosticOrder.create({
				data: {
					orderNo: `TEST-LAB-${index + 1}`,
					encounterId: visits[index * 2],
					status: 'RELEASED',
					items: {
						create: {
							testId: hba1c.id,
							status: 'RELEASED',
							result: {
								create: {
									resultedAt: at,
									releasedAt: at,
									values: {
										create: {
											parameterId: hba1c.parameters[0].id,
											name: 'HbA1c',
											value: String(value),
											numericValue: value,
											unit: '%',
											flag: 'HIGH',
										},
									},
								},
							},
						},
					},
				},
			});
		}
	});

	afterAll(async () => {
		await closeBrowser();
		await app?.close();
	});

	it("charts a patient's blood pressure as the user, with the 140/90 thresholds, and audits it", async () => {
		const events = await ask(users.reyes.cookie, [
			{ toolName: 'chart_patient_trend', input: { measure: 'blood_pressure', patientId } },
		]);
		const output = events.find((event) => event.type === 'tool-output-available')?.output;
		expect(output).toMatchObject({ measure: 'blood_pressure', patient: { id: patientId, name: 'Maria Santos' } });
		expect(output.chart.rows.map((row: Record<string, number>) => [row.systolic, row.diastolic])).toEqual([
			[132, 84],
			[136, 86],
			[140, 90],
		]);
		expect(output.chart.rows[0]).toMatchObject({ systolic_threshold: 140, diastolic_threshold: 90 });
		const audit = await prisma.auditLog.findMany({
			where: { userId: users.reyes.id, patientId, event: 'patient.view' },
			select: { reason: true },
		});
		expect(audit.map((row) => row.reason)).toContain('Wise chart blood_pressure');
	});

	it('refuses a narrative with a number the record does not hold', async () => {
		const events = await ask(users.reyes.cookie, [
			{
				toolName: 'create_report',
				input: { type: 'patient_summary', patientId, narrative: 'HbA1c rose to 9.4%, BP 140/90.' },
			},
		]);
		const refused = events.find((event) => event.type === 'tool-output-error');
		expect(refused?.errorText).toMatch(/numbers the report's data doesn't contain \(9\.4\)/);
	});

	it('builds a patient summary from the record, audits it, and prints it to PDF for its owner only', async () => {
		const narrative = 'BP has crept up to 140/90 and HbA1c rose from 6.1% to 7.2% over 6 months.';
		const events = await ask(users.reyes.cookie, [
			{ toolName: 'create_report', input: { type: 'patient_summary', patientId, narrative } },
		]);
		const output = events.find((event) => event.type === 'tool-output-available')?.output;
		expect(output.narrative).toBe(narrative);
		expect(output.snapshot).toMatchObject({
			type: 'patient_summary',
			subject: expect.stringMatching(/^Maria Santos · F · \d+ y$/),
			patientId,
			generatedBy: doctorName,
		});
		const titles = output.snapshot.sections.map((section: { title: string }) => section.title);
		expect(titles).toEqual([
			'Patient',
			'Allergies',
			'Problems and diagnoses',
			'Current medicines (issued in the last 180 days)',
			'Latest vital signs',
			'Recent laboratory results',
			'Blood pressure',
			'HbA1c',
			'Encounters',
		]);
		expect(await prisma.auditLog.count({ where: { patientId, event: 'report.generate' } })).toBe(1);

		const report = await latestReport(users.reyes.id);
		const other = await graphql(users.cruz.cookie, EXPORT, report);
		expect(other.body.errors?.[0]?.message).toBe('Report not found.');
		const anonymous = await graphql([], EXPORT, report);
		expect(anonymous.body.errors).toBeDefined();
		expect(await prisma.auditLog.count({ where: { patientId, event: 'report.export' } })).toBe(0);

		if (!hasChrome()) {
			console.warn('No Chrome or Chromium on this machine: the PDF itself is not printed.');
			return;
		}
		const res = await graphql(users.reyes.cookie, EXPORT, report);
		expect(res.body.errors).toBeUndefined();
		const pdf = res.body.data.exportReportPdf;
		expect(pdf.mimeType).toBe('application/pdf');
		expect(pdf.filename).toMatch(/^patient-summary-santos-\d{4}-\d{2}-\d{2}\.pdf$/);
		expect(Buffer.from(pdf.data, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
		const exported = await prisma.auditLog.findMany({ where: { patientId, event: 'report.export' } });
		expect(exported).toMatchObject([
			{
				userId: users.reyes.id,
				action: 'EXPORT',
				entityType: 'Report',
				entityId: report.toolCallId,
				reason: 'PDF download',
			},
		]);
	}, 60_000);

	it("counts the visits at the user's clinic (the panel report's data), and refuses a clinic they don't work at", async () => {
		const insights = app.get(InsightsService, { strict: false });
		const output = await insights.facilityPanel(users.reyes.id, 'encounters_by_week');
		expect(output).toMatchObject({ metric: 'encounters_by_week', facility: { id: facilityId } });
		const total = output.chart.rows.reduce((sum, row) => sum + Number(row.encounters), 0);
		// The scene's open visit and the three check-ups.
		expect(total).toBe(4);
		expect(
			await prisma.auditLog.count({
				where: { userId: users.reyes.id, clinicId: facilityId, event: 'panel.view' },
			}),
		).toBe(1);
		await expect(insights.facilityPanel(users.reyes.id, 'encounters_by_week', otherClinicId)).rejects.toThrow(
			/only see the panel of a clinic you work at/,
		);
	});

	it('summarizes one visit for a doctor in the care of the patient, and a facility panel without names', async () => {
		const events = await ask(users.reyes.cookie, [
			{
				toolName: 'create_report',
				input: { type: 'encounter_summary', encounterId, narrative: 'BP 140/90 at this visit.' },
			},
			{ toolName: 'create_report', input: { type: 'facility_panel', narrative: '3 encounters this period.' } },
		]);
		const [visit, panel] = events
			.filter((event) => event.type === 'tool-output-available')
			.map((event) => event.output.snapshot);
		expect(visit).toMatchObject({
			type: 'encounter_summary',
			patientId,
			subject: expect.stringMatching(/ · visit /),
		});
		expect(panel).toMatchObject({ type: 'facility_panel', patientId: null, facility: { id: facilityId } });
		expect(JSON.stringify(panel)).not.toContain('Maria');
		expect(
			await prisma.auditLog.count({
				where: { userId: users.reyes.id, event: 'report.generate', clinicId: facilityId },
			}),
		).toBe(2);
	});

	it('neither charts nor reports a patient for a doctor without a care relationship', async () => {
		const events = await ask(users.cruz.cookie, [
			{ toolName: 'chart_patient_trend', input: { measure: 'blood_pressure', patientId } },
			{ toolName: 'create_report', input: { type: 'patient_summary', patientId, narrative: 'Stable.' } },
			{ toolName: 'create_report', input: { type: 'encounter_summary', encounterId, narrative: 'Stable.' } },
		]);
		const errors = events.filter((event) => event.type === 'tool-output-error').map((event) => event.errorText);
		expect(errors).toEqual([
			expect.stringMatching(/Patient not found/),
			expect.stringMatching(/Patient not found/),
			expect.stringMatching(/Encounter not found/),
		]);
		expect(events.some((event) => event.type === 'tool-output-available')).toBe(false);
		expect(await prisma.auditLog.count({ where: { userId: users.cruz.id, patientId } })).toBe(0);
	});

	it("saves a patient report to the chart once, for the doctor in the patient's care only", async () => {
		const chartId = `trend_${crypto.randomUUID()}`;
		const reportId = `report_${crypto.randomUUID()}`;
		await ask(users.reyes.cookie, [
			{ toolName: 'chart_patient_trend', input: { measure: 'blood_pressure', patientId }, toolCallId: chartId },
			{
				toolName: 'report',
				toolCallId: reportId,
				input: {
					action: 'create',
					id: 'bp',
					title: 'Maria BP',
					patientId,
					code: `# Blood pressure\nLatest 140/90.\n<chart ref="${chartId}"/>`,
				},
			},
		]);
		const { message: chatMessage } = await prisma.messagePart.findFirstOrThrow({
			where: { toolCallId: reportId },
			select: { message: { select: { chatId: true } } },
		});
		const save = (cookie: string[]) =>
			graphql(
				cookie,
				'mutation ($c: ID!, $t: String!) { saveReportToChart(chatId: $c, toolCallId: $t) { id patientId title version data createdByName } }',
				{ c: chatMessage.chatId, t: reportId },
			);

		expect((await save(users.cruz.cookie)).body.errors?.[0]?.message).toBe('Report not found.');
		const saved = (await save(users.reyes.cookie)).body.data.saveReportToChart;
		expect(saved).toMatchObject({ patientId, title: 'Maria BP', version: 1, createdByName: doctorName });
		expect(Object.keys(saved.data)).toEqual([chartId]);
		expect((await save(users.reyes.cookie)).body.errors?.[0]?.message).toBe(
			'This version is already saved to the chart.',
		);
		expect(
			await prisma.auditLog.count({ where: { event: 'document.create', entityId: saved.id, patientId } }),
		).toBe(1);

		const library = (cookie: string[]) =>
			graphql(cookie, '{ myReports { chatId reportId title version toolCallId patientId patientName } }');
		expect((await library(users.reyes.cookie)).body.data.myReports).toContainEqual({
			chatId: chatMessage.chatId,
			reportId: 'bp',
			title: 'Maria BP',
			version: 1,
			toolCallId: reportId,
			patientId,
			patientName: expect.stringContaining('Maria'),
		});
		expect(
			(await library(users.cruz.cookie)).body.data.myReports.filter(
				(row: { toolCallId: string }) => row.toolCallId === reportId,
			),
		).toEqual([]);

		const list = (cookie: string[]) =>
			graphql(cookie, 'query ($p: ID!) { patientDocuments(patientId: $p) { id } }', { p: patientId });
		expect((await list(users.reyes.cookie)).body.data.patientDocuments).toEqual([{ id: saved.id }]);
		expect((await list(users.cruz.cookie)).body.data.patientDocuments).toEqual([]);
		const open = (cookie: string[]) =>
			graphql(cookie, 'query ($id: ID!) { clinicalDocument(id: $id) { title } }', { id: saved.id });
		expect((await open(users.cruz.cookie)).body.data.clinicalDocument).toBeNull();
		expect((await open(users.reyes.cookie)).body.data.clinicalDocument).toEqual({ title: 'Maria BP' });
		expect(await prisma.auditLog.count({ where: { event: 'document.view', entityId: saved.id } })).toBe(1);

		await expect(
			prisma.clinicalDocument.update({ where: { id: saved.id }, data: { title: 'changed' } }),
		).rejects.toThrow(/append-only/i);
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
								toolCallId: call.toolCallId ?? `call_${++callId}`,
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
