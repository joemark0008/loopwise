import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DiagnosticsWiseReader } from '../src/clinical/diagnostics/diagnostics-wise-reader.js';
import { DiagnosticOrderService } from '../src/clinical/diagnostics/orders/diagnostic-order.service.js';
import { ResultsInboxService } from '../src/clinical/diagnostics/results/results-inbox.service.js';
import { LabWorklistService } from '../src/clinical/diagnostics/worklist/lab-worklist.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	type ClinicScene,
	createClinicScene,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import {
	createDiagnosticsTestingModule,
	createTestCatalog,
	type TestCatalog,
} from './fixtures/diagnostics-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

async function errorCode(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (error) {
		return (error as { errorCode?: string }).errorCode ?? (error as Error).message;
	}
	throw new Error('Expected the call to fail');
}

/**
 * The doctor's results inbox end to end: only released results reach it, critical first; it belongs to the
 * requesting doctor and the patient's care team (not the lab, not a doctor outside the care team); the review is once,
 * audited with the note; a critical result confirmed from a Wise card needs the note; the patient's results tab and
 * Wise's `list_results_to_review` read the same results, audited.
 */
describe('results inbox (e2e)', () => {
	let moduleRef: TestingModule;
	let prisma: PrismaService;
	let inbox: ResultsInboxService;
	let worklist: LabWorklistService;
	let scene: ClinicScene;
	let catalog: TestCatalog;
	let medtech: FixtureUser;
	const results = { critical: '', abnormal: '', unreleased: '' };

	/** Orders `testId` for Maria's visit, and the lab enters `values` (by parameter index) and releases unless told. */
	const resulted = async (testId: string, values: { value: string; critical?: boolean }[], release = true) => {
		const order = await moduleRef
			.get(DiagnosticOrderService)
			.create(scene.doctor.id, { encounterId: scene.encounter.id, testIds: [testId] });
		const test = [catalog.hba1c, catalog.cbc].find((candidate) => candidate.id === testId)!;
		const parameters = [...test.parameters].sort((a, b) => a.sortOrder - b.sortOrder);
		const item = await worklist.enterResult(medtech.id, {
			itemId: order.items[0].id,
			values: values.map((entry, index) => ({ parameterId: parameters[index].id, ...entry })),
		});
		if (release) {
			await worklist.release(medtech.id, item.id);
		}
		return item.result!.id;
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		moduleRef = await createDiagnosticsTestingModule();
		prisma = moduleRef.get(PrismaService);
		inbox = moduleRef.get(ResultsInboxService);
		worklist = moduleRef.get(LabWorklistService);
		scene = await createClinicScene(prisma);
		medtech = await createUser(prisma, { firstName: 'Mark', lastName: 'Bautista' });
		await grantClinicRoles(prisma, scene.clinic.id, medtech.id, ['MEDTECH']);
		catalog = await createTestCatalog(prisma, scene.organization.id);

		results.abnormal = await resulted(catalog.cbc.id, [{ value: '11.0' }, { value: '7.0' }]);
		results.critical = await resulted(catalog.hba1c.id, [{ value: '12.4', critical: true }]);
		results.unreleased = await resulted(catalog.hba1c.id, [{ value: '5.2' }], false);
	});

	afterAll(async () => {
		await moduleRef?.close();
	});

	it('lists the released results to review, critical first, to the requesting doctor and the care team', async () => {
		const mine = await inbox.toReview(scene.doctor.id);
		expect(mine.map((report) => [report.id, report.urgency])).toEqual([
			[results.critical, 'CRITICAL'],
			[results.abnormal, 'ABNORMAL'],
		]);
		expect(mine[0]).toMatchObject({
			test: { code: 'HBA1C' },
			patient: { firstName: 'Maria' },
			flag: 'CRITICAL_HIGH',
			values: [{ name: 'HbA1c', value: '12.4', referenceRange: '4–5.6', loincCode: '4548-4' }],
			order: { requestedByName: 'Dr. Jose Reyes' },
		});
		// The admin is in Maria's care team; the lab and a doctor outside it get nothing.
		expect((await inbox.toReview(scene.admin.id)).map((report) => report.id)).toContain(results.critical);
		expect(await inbox.toReview(medtech.id)).toEqual([]);
		expect(await inbox.toReview(scene.otherDoctor.id)).toEqual([]);
		expect(await prisma.auditLog.count({ where: { event: 'result.inbox', userId: scene.doctor.id } })).toBe(1);
	});

	it("shows the patient's released results on the results tab, audited", async () => {
		const tab = await inbox.forPatient(scene.doctor.id, scene.patient.id);
		expect(tab.map((report) => report.id).sort()).toEqual([results.abnormal, results.critical].sort());
		expect(await inbox.forPatient(scene.otherDoctor.id, scene.patient.id)).toEqual([]);
		expect(
			await prisma.auditLog.count({
				where: { event: 'result.list', userId: scene.doctor.id, patientId: scene.patient.id },
			}),
		).toBe(1);
	});

	it('reviews a released result once, by a reviewer, with the note in the audit row', async () => {
		expect(await errorCode(inbox.review(medtech.id, { resultId: results.abnormal }))).toBe('NOT_RESULT_REVIEWER');
		expect(await errorCode(inbox.review(scene.doctor.id, { resultId: results.unreleased }))).toBe(
			'RESULT_NOT_RELEASED',
		);
		const reviewed = await inbox.review(scene.doctor.id, {
			resultId: results.abnormal,
			note: 'Mild anemia; iron studies at follow-up',
		});
		expect(reviewed.reviewedAt).not.toBeNull();
		expect(await errorCode(inbox.review(scene.doctor.id, { resultId: results.abnormal }))).toBe(
			'RESULT_ALREADY_REVIEWED',
		);
		expect(await prisma.auditLog.findFirstOrThrow({ where: { event: 'result.review' } })).toMatchObject({
			action: 'UPDATE',
			entityType: 'DiagnosticResult',
			entityId: results.abnormal,
			userId: scene.doctor.id,
			reason: 'Mild anemia; iron studies at follow-up',
		});
		expect((await inbox.toReview(scene.doctor.id)).map((report) => report.id)).toEqual([results.critical]);
	});

	it("gives Wise the inbox in the tool's shape, audited with the reason", async () => {
		const reader = moduleRef.get(DiagnosticsWiseReader);
		const listed = await reader.resultsToReviewForWise(scene.doctor.id, { limit: 20, urgency: 'critical' });
		expect(listed).toEqual({
			truncated: false,
			results: [
				expect.objectContaining({
					id: results.critical,
					test: 'Hemoglobin A1c (HbA1c)',
					urgency: 'critical',
					values: [
						{ name: 'HbA1c', value: '12.4', unit: '%', referenceRange: '4–5.6', flag: 'CRITICAL_HIGH' },
					],
					patient: expect.objectContaining({ name: expect.stringContaining('Maria') }),
				}),
			],
		});
		expect(
			await prisma.auditLog.count({ where: { event: 'result.list', reason: 'Wise list_results_to_review' } }),
		).toBe(1);
		const worklistForWise = await reader.labWorklistForWise(medtech.id, scene.clinic.id, {
			statuses: ['RESULTED'],
			limit: 30,
		});
		expect(worklistForWise.orders.map((order) => order.status)).toEqual(['RESULTED']);
		expect(
			await errorCode(
				reader.labWorklistForWise(scene.doctor.id, scene.clinic.id, { statuses: ['RESULTED'], limit: 30 }),
			),
		).toBe('LAB_DESK_ACCESS_DENIED');
	});

	it("needs the doctor's note to confirm a critical result from a Wise card", async () => {
		const chat = await prisma.chat.create({
			data: { userId: scene.doctor.id, clinicId: scene.clinic.id, patientId: scene.patient.id },
		});
		const message = await prisma.chatMessage.create({ data: { chatId: chat.id, role: 'assistant' } });
		const toolCallId = 'call_review_critical';
		await prisma.messagePart.create({
			data: {
				messageId: message.id,
				order: 0,
				type: 'tool-propose_result_review',
				toolCallId,
				toolName: 'propose_result_review',
				toolState: 'output-available',
				toolInput: { resultId: results.critical },
			},
		});
		const wiseOrigin = { chatId: chat.id, toolCallId, toolName: 'propose_result_review', edited: false };
		expect(await errorCode(inbox.review(scene.doctor.id, { resultId: results.critical, wiseOrigin }))).toBe(
			'CRITICAL_REVIEW_NOTE_REQUIRED',
		);
		const reviewed = await inbox.review(scene.doctor.id, {
			resultId: results.critical,
			note: 'Called the patient; seen today.',
			wiseOrigin,
		});
		expect(reviewed.reviewedAt).not.toBeNull();
		const audit = await prisma.auditLog.findFirstOrThrow({
			where: { event: 'result.review', entityId: results.critical },
		});
		expect(audit.origin).toMatchObject({ via: 'wise', toolName: 'propose_result_review', toolCallId });
		expect(await prisma.wiseProposalOutcome.count({ where: { toolCallId } })).toBe(1);
	});
});
