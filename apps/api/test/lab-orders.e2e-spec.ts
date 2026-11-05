import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DiagnosticTestService } from '../src/clinical/diagnostics/catalog/diagnostic-test.service.js';
import { DiagnosticOrderService } from '../src/clinical/diagnostics/orders/diagnostic-order.service.js';
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

/** The domain error a call failed with: its stable code. */
async function errorCode(promise: Promise<unknown>): Promise<string> {
	try {
		await promise;
	} catch (error) {
		return (error as { errorCode?: string }).errorCode ?? (error as Error).message;
	}
	throw new Error('Expected the call to fail');
}

/**
 * Lab orders end to end against the database: the doctor requests tests from a visit (numbered per clinic), the
 * clinic's medtech works them on the lab worklist (collect, enter results flagged from the sex-specific range,
 * release), the status machine refuses steps out of order in the API and in Postgres, the header follows its tests,
 * and every step is audited. Row-level security keeps the worklist and the visit's orders to the right people.
 */
describe('lab orders (e2e)', () => {
	let moduleRef: TestingModule;
	let prisma: PrismaService;
	let orders: DiagnosticOrderService;
	let worklist: LabWorklistService;
	let scene: ClinicScene;
	let catalog: TestCatalog;
	let medtech: FixtureUser;
	let orderId = '';
	const itemOf = async (testId: string) =>
		prisma.diagnosticOrderItem.findFirstOrThrow({ where: { orderId, testId } });

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		moduleRef = await createDiagnosticsTestingModule();
		prisma = moduleRef.get(PrismaService);
		orders = moduleRef.get(DiagnosticOrderService);
		worklist = moduleRef.get(LabWorklistService);
		scene = await createClinicScene(prisma);
		medtech = await createUser(prisma, { firstName: 'Mark', lastName: 'Bautista' });
		await grantClinicRoles(prisma, scene.clinic.id, medtech.id, ['MEDTECH']);
		catalog = await createTestCatalog(prisma, scene.organization.id);
	});

	afterAll(async () => {
		await moduleRef?.close();
	});

	it("lists the organization's catalog with each test's analytes and ranges", async () => {
		const tests = await moduleRef
			.get(DiagnosticTestService)
			.listForOrganization(scene.doctor.id, scene.organization.id);
		expect(tests.map((test) => test.code)).toEqual(['CBC', 'HBA1C', 'CXR-PA']);
		const cbc = tests.find((test) => test.code === 'CBC')!;
		expect(cbc.parameters[0]).toMatchObject({
			code: 'HGB',
			refLowFemale: 12,
			refHighFemale: 15.5,
			loincCode: '718-7',
		});
	});

	it('requests several tests as one numbered order, audited', async () => {
		const order = await orders.create(scene.doctor.id, {
			encounterId: scene.encounter.id,
			testIds: [catalog.cbc.id, catalog.hba1c.id, catalog.cxr.id],
			priority: 'URGENT',
			clinicalInfo: 'Fatigue, r/o anemia and diabetes',
		});
		orderId = order.id;
		expect(order.orderNo).toMatch(new RegExp(`^${scene.clinic.code}-LAB-\\d{4}-000001$`));
		expect(order).toMatchObject({ status: 'REQUESTED', priority: 'URGENT', requestedByName: 'Dr. Jose Reyes' });
		expect(order.items.map((item) => [item.test.code, item.status])).toEqual([
			['CBC', 'REQUESTED'],
			['HBA1C', 'REQUESTED'],
			['CXR-PA', 'REQUESTED'],
		]);
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { event: 'diagnostic_order.create' } });
		expect(audit).toMatchObject({
			action: 'CREATE',
			entityId: order.id,
			userId: scene.doctor.id,
			patientId: scene.patient.id,
		});

		const listed = await orders.listForEncounter(scene.doctor.id, scene.encounter.id);
		expect(listed.map((row) => row.id)).toEqual([order.id]);
	});

	it('refuses tests outside the catalog, a user who is not a physician, and a visit the user cannot see', async () => {
		expect(
			await errorCode(
				orders.create(scene.doctor.id, { encounterId: scene.encounter.id, testIds: [scene.patient.id] }),
			),
		).toBe('DIAGNOSTIC_TEST_NOT_ORDERABLE');
		expect(
			await errorCode(
				orders.create(medtech.id, { encounterId: scene.encounter.id, testIds: [catalog.hba1c.id] }),
			),
		).toBe('REQUESTING_PHYSICIAN_REQUIRED');
		expect(
			await errorCode(
				orders.create(scene.otherDoctor.id, { encounterId: scene.encounter.id, testIds: [catalog.hba1c.id] }),
			),
		).toBe('ENTITY_NOT_FOUND');
		expect(await prisma.diagnosticOrder.count()).toBe(1);
	});

	it("keeps the lab worklist to the clinic's lab desk, STAT first", async () => {
		expect(await errorCode(worklist.list(scene.doctor.id, scene.clinic.id))).toBe('LAB_DESK_ACCESS_DENIED');
		const items = await worklist.list(medtech.id, scene.clinic.id);
		expect(items.map((item) => item.test.code).sort()).toEqual(['CBC', 'CXR-PA', 'HBA1C']);
		expect(items[0]).toMatchObject({
			order: { orderNo: expect.stringContaining('-LAB-') },
			patient: { firstName: 'Maria' },
		});
		expect(await worklist.counts(medtech.id, scene.clinic.id)).toContainEqual({ status: 'REQUESTED', count: 3 });
		expect(await prisma.auditLog.count({ where: { event: 'lab_worklist.list', userId: medtech.id } })).toBe(1);
	});

	it('collects a specimen once; a second collect is refused', async () => {
		const cbc = await itemOf(catalog.cbc.id);
		const collected = await worklist.collect(medtech.id, { itemId: cbc.id, accessionNo: 'ACC-0001' });
		expect(collected).toMatchObject({ status: 'SPECIMEN_COLLECTED', accessionNo: 'ACC-0001' });
		expect(await errorCode(worklist.collect(medtech.id, { itemId: cbc.id }))).toBe('INVALID_STATUS_TRANSITION');
		expect(await errorCode(worklist.collect(scene.doctor.id, { itemId: cbc.id }))).toBe('LAB_DESK_ACCESS_DENIED');
		const hba1c = await worklist.collect(medtech.id, { itemId: (await itemOf(catalog.hba1c.id)).id });
		expect(hba1c.accessionNo).toBe(`${hba1c.order.orderNo}-HBA1C`);
		// The header waits for its least advanced test (the X-ray is still requested).
		expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('REQUESTED');
	});

	it("enters results flagged from the patient's sex-specific range, and releases them", async () => {
		const cbc = await itemOf(catalog.cbc.id);
		const [hgb, wbc] = catalog.cbc.parameters.sort((a, b) => a.sortOrder - b.sortOrder);
		expect(
			await errorCode(
				worklist.enterResult(medtech.id, { itemId: cbc.id, values: [{ parameterId: hgb.id, value: 'low' }] }),
			),
		).toBe('INVALID_RESULT_VALUE');
		const entered = await worklist.enterResult(medtech.id, {
			itemId: cbc.id,
			values: [
				{ parameterId: hgb.id, value: '11.2' },
				{ parameterId: wbc.id, value: '7.1' },
			],
		});
		expect(entered.status).toBe('RESULTED');
		expect(entered.result?.values.map(({ name, flag, referenceRange }) => [name, flag, referenceRange])).toEqual([
			['Hemoglobin', 'LOW', '12–15.5'],
			['White blood cells', 'NORMAL', '4.5–11'],
		]);
		expect(entered.result).toMatchObject({ urgency: 'ABNORMAL', flag: 'LOW', releasedAt: null });

		const released = await worklist.release(medtech.id, cbc.id);
		expect(released.status).toBe('RELEASED');
		expect(released.result?.releasedAt).not.toBeNull();
		expect(await prisma.auditLog.findFirstOrThrow({ where: { event: 'diagnostic_result.release' } })).toMatchObject(
			{
				action: 'SIGN',
				entityId: cbc.id,
			},
		);
	});

	it('cancels a test before its result, and the header follows the tests that remain', async () => {
		const cxr = await itemOf(catalog.cxr.id);
		expect(
			await errorCode(
				orders.cancel(medtech.id, { orderId, itemId: (await itemOf(catalog.cbc.id)).id, reason: 'x' }),
			),
		).toBe('INVALID_STATUS_TRANSITION');
		expect(await errorCode(orders.cancel(scene.otherDoctor.id, { orderId, itemId: cxr.id, reason: 'x' }))).toBe(
			'ENTITY_NOT_FOUND',
		);
		const cancelled = await orders.cancel(scene.doctor.id, { orderId, itemId: cxr.id, reason: 'Done elsewhere' });
		expect(cancelled.items.find((item) => item.id === cxr.id)).toMatchObject({
			status: 'CANCELLED',
			statusReason: 'Done elsewhere',
		});
		expect(cancelled.status).toBe('SPECIMEN_COLLECTED');

		const hba1c = await itemOf(catalog.hba1c.id);
		await worklist.start(medtech.id, hba1c.id);
		await worklist.enterResult(medtech.id, {
			itemId: hba1c.id,
			values: [{ parameterId: catalog.hba1c.parameters[0].id, value: '12.1', critical: true }],
		});
		await worklist.release(medtech.id, hba1c.id);
		expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('RELEASED');
	});

	it('the database refuses a move the status machine does not allow, for every writer', async () => {
		const hba1c = await itemOf(catalog.hba1c.id);
		await expect(
			prisma.diagnosticOrderItem.update({ where: { id: hba1c.id }, data: { status: 'CANCELLED' } }),
		).rejects.toThrow(/cannot go from RELEASED to CANCELLED/);
	});

	it('corrects a released result: back through in progress, to be released and reviewed again', async () => {
		const hba1c = await itemOf(catalog.hba1c.id);
		const corrected = await worklist.enterResult(medtech.id, {
			itemId: hba1c.id,
			values: [{ parameterId: catalog.hba1c.parameters[0].id, value: '11.9', critical: true }],
			remarks: 'Transcription error',
		});
		expect(corrected).toMatchObject({ status: 'RESULTED', result: { releasedAt: null, flag: 'CRITICAL_HIGH' } });
		expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('RESULTED');
		expect(await prisma.auditLog.findFirstOrThrow({ where: { event: 'diagnostic_result.correct' } })).toMatchObject(
			{ action: 'UPDATE', reason: 'Transcription error' },
		);
	});

	describe('Wise cards', () => {
		/** A Wise tool call in the user's chat (the card), as the agent stores it. */
		const chats = new Map<string, string>();
		const card = async (user: FixtureUser, toolName: string, patientId: string | null) => {
			const key = `${user.id}:${patientId}`;
			const chatId =
				chats.get(key) ??
				(await prisma.chat.create({ data: { userId: user.id, clinicId: scene.clinic.id, patientId } })).id;
			chats.set(key, chatId);
			const message = await prisma.chatMessage.create({ data: { chatId, role: 'assistant' } });
			const toolCallId = `call_${toolName}_${message.id}`;
			await prisma.messagePart.create({
				data: {
					messageId: message.id,
					order: 0,
					type: `tool-${toolName}`,
					toolCallId,
					toolName,
					toolState: 'output-available',
				},
			});
			return { chatId, toolCallId, toolName, edited: false };
		};

		it('orders from a propose_order card once, with the Wise origin on the audit row', async () => {
			const wiseOrigin = await card(scene.doctor, 'propose_order', scene.patient.id);
			const order = await orders.create(scene.doctor.id, {
				encounterId: scene.encounter.id,
				testIds: [catalog.hba1c.id],
				wiseOrigin,
			});
			const audit = await prisma.auditLog.findFirstOrThrow({
				where: { event: 'diagnostic_order.create', entityId: order.id },
			});
			expect(audit.origin).toMatchObject({ via: 'wise', toolName: 'propose_order' });
			expect(
				await errorCode(
					orders.create(scene.doctor.id, {
						encounterId: scene.encounter.id,
						testIds: [catalog.hba1c.id],
						wiseOrigin,
					}),
				),
			).toBe('WISE_CARD_ALREADY_SETTLED');
			expect(await prisma.diagnosticOrder.count({ where: { id: { not: orderId } } })).toBe(1);
			orderId = order.id;
		});

		it('refuses a card from the wrong tool, then moves a test from the lab desk card', async () => {
			const item = await itemOf(catalog.hba1c.id);
			const wrong = await card(medtech, 'propose_order', null);
			await expect(worklist.collect(medtech.id, { itemId: item.id, wiseOrigin: wrong })).rejects.toThrow(
				/can't confirm this change/,
			);
			const wiseOrigin = await card(medtech, 'propose_lab_order_step', null);
			const collected = await worklist.collect(medtech.id, { itemId: item.id, wiseOrigin });
			expect(collected.status).toBe('SPECIMEN_COLLECTED');
			const audit = await prisma.auditLog.findFirstOrThrow({
				where: { event: 'diagnostic_order.collect', entityId: item.id },
			});
			expect(audit.origin).toMatchObject({ toolName: 'propose_lab_order_step' });
		});

		it('cancels from a propose_cancel_order card with the reason', async () => {
			const item = await itemOf(catalog.hba1c.id);
			const wiseOrigin = await card(scene.doctor, 'propose_cancel_order', scene.patient.id);
			const cancelled = await orders.cancel(scene.doctor.id, {
				orderId,
				itemId: item.id,
				reason: 'Patient declined',
				wiseOrigin,
			});
			expect(cancelled.status).toBe('CANCELLED');
			expect(
				await prisma.auditLog.findFirstOrThrow({
					where: { event: 'diagnostic_order.cancel', entityId: item.id },
				}),
			).toMatchObject({
				reason: 'Patient declined',
				origin: expect.objectContaining({ toolName: 'propose_cancel_order' }),
			});
		});
	});
});
