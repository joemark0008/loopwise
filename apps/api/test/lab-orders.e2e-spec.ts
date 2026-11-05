import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Hl7OutboxService } from '../src/clinical/orders/hl7/hl7-outbox.service.js';
import { OrderService } from '../src/clinical/orders/order.service.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { FacilityKeyService } from '../src/facility-keys/facility-key.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const CREATE = `mutation ($input: CreateEncounterOrderInput!) { createEncounterOrder(input: $input) { id status } }`;
const ACCEPT = `mutation ($id: ID!) { acceptOrder(orderId: $id) { id status acceptedAt } }`;
const COLLECT = `mutation ($id: ID!) { markOrderCollected(orderId: $id) { id status collectedAt } }`;
const REJECT = `mutation ($input: OrderReasonInput!) { rejectOrder(input: $input) { id status statusReason closedAt } }`;
const CANCEL = `mutation ($input: OrderReasonInput!) { cancelOrder(input: $input) { id status statusReason } }`;
const WORKLIST = `query ($status: OrderStatus!) {
	labOrders(status: $status) {
		id code display priority status sentAt orderingDoctorName orderingFacilityName
		patient { givenName familyName birthDate sex }
	}
}`;
const COUNTS = `{ labOrderCounts { status count } }`;

/**
 * The lab side of orders (DESIGN.md §2 steps 2–5, §5, §9): the receiving facility's worklist and steps under
 * row-level security, the transitions the API and Postgres refuse, audit rows, and outbound HL7 through `hl7_outbox`.
 */
describe('lab orders (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let encounterId = '';
	let patientId = '';
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		lim: { cookie: [] as string[], id: '' },
		bautista: { cookie: [] as string[], id: '' },
		otherLab: { cookie: [] as string[], id: '' },
	};
	const facilities = { healthCenter: '', otherClinic: '', lab: '', connectorLab: '', otherLab: '' };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	const ok = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(cookie, query, variables);
		expect(res.body.errors).toBeUndefined();
		return res.body.data;
	};

	const errorOf = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(cookie, query, variables);
		expect(res.body.errors).toBeDefined();
		return { message: res.body.errors[0].message as string, code: res.body.errors[0].extensions?.code };
	};

	const order = async (targetOrgId = facilities.lab, code = '4548-4') =>
		(await ok(users.reyes.cookie, CREATE, { input: { encounterId, code, targetOrgId } })).createEncounterOrder
			.id as string;

	const audits = (action: string, resourceId: string) =>
		prisma.auditLog.findMany({ where: { action, resourceId }, orderBy: { at: 'asc' } });

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);

		const password = 'Sup3r-secret!';
		for (const key of ['reyes', 'lim', 'bautista', 'otherLab'] as const) {
			const user = await createTestUser(app, {
				name: `Staff ${key}`,
				email: `${key.toLowerCase()}@example.com`,
				password,
			});
			users[key] = { cookie: user.cookie, id: user.userId };
		}
		const workspace = await prisma.organization.findFirstOrThrow();
		await prisma.project.create({ data: { name: 'Loopwise', type: 'local', path: '/tmp/x', orgId: workspace.id } });
		const org = (name: string, slug: string, type: 'clinic' | 'lab', usesHl7Connector = false) =>
			prisma.organization.create({ data: { name, slug, type, usesHl7Connector } });
		facilities.healthCenter = (await org('Health Center', 'hc', 'clinic')).id;
		facilities.otherClinic = (await org('Other Clinic', 'oc', 'clinic')).id;
		facilities.lab = (await org('Bohol Lab', 'lab', 'lab')).id;
		facilities.connectorLab = (await org('Connector Lab', 'clab', 'lab', true)).id;
		facilities.otherLab = (await org('Other Lab', 'olab', 'lab')).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilities.healthCenter, userId: users.reyes.id, role: 'user' },
				{ orgId: facilities.healthCenter, userId: users.lim.id, role: 'user' },
				{ orgId: facilities.lab, userId: users.bautista.id, role: 'user' },
				{ orgId: facilities.otherLab, userId: users.otherLab.id, role: 'user' },
			],
		});

		const maria = await prisma.patient.create({
			data: {
				givenName: 'Maria',
				familyName: 'Santos',
				birthDate: new Date('1981-04-12'),
				sex: 'female',
				phone: '+639170000001',
				careRelationships: {
					create: [
						{ userId: users.reyes.id, orgId: facilities.healthCenter, reason: 'encounter' },
						{ userId: users.lim.id, orgId: facilities.healthCenter, reason: 'encounter' },
					],
				},
				identifiers: {
					create: [
						{ orgId: facilities.healthCenter, system: 'MRN', value: 'HC-0001' },
						{ orgId: facilities.connectorLab, system: 'MRN', value: 'CL-42' },
					],
				},
			},
		});
		patientId = maria.id;
		const created = await ok(
			users.reyes.cookie,
			'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
			{ input: { patientId, facilityId: facilities.healthCenter, reason: 'Fatigue' } },
		);
		encounterId = created.createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('shows the order on the lab worklist, accepts it and marks it collected, with audit rows', async () => {
		const id = await order();
		const { labOrders } = await ok(users.bautista.cookie, WORKLIST, { status: 'sent' });
		expect(labOrders).toEqual([
			expect.objectContaining({
				id,
				code: '4548-4',
				display: 'Hemoglobin A1c',
				priority: 'routine',
				status: 'sent',
				orderingDoctorName: 'Staff reyes',
				orderingFacilityName: 'Health Center',
				patient: { givenName: 'Maria', familyName: 'Santos', birthDate: '1981-04-12', sex: 'female' },
			}),
		]);
		expect((await ok(users.bautista.cookie, COUNTS)).labOrderCounts).toContainEqual({ status: 'sent', count: 1 });

		const { acceptOrder } = await ok(users.bautista.cookie, ACCEPT, { id });
		expect(acceptOrder.status).toBe('accepted');
		expect(acceptOrder.acceptedAt).toBeTruthy();
		const { markOrderCollected } = await ok(users.bautista.cookie, COLLECT, { id });
		expect(markOrderCollected.status).toBe('collected');
		expect((await ok(users.bautista.cookie, WORKLIST, { status: 'collected' })).labOrders).toHaveLength(1);
		expect((await ok(users.bautista.cookie, WORKLIST, { status: 'sent' })).labOrders).toHaveLength(0);

		const [accepted] = await audits('order.accept', id);
		expect(accepted).toMatchObject({ userId: users.bautista.id, orgId: facilities.lab, patientId });
		expect(await audits('order.collect', id)).toHaveLength(1);

		// The ordering doctor sees the status on the encounter record.
		const { encounterRecord } = await ok(
			users.reyes.cookie,
			'query ($id: ID!) { encounterRecord(encounterId: $id) { orders { id status collectedAt } } }',
			{ id: encounterId },
		);
		expect(encounterRecord.orders).toContainEqual(expect.objectContaining({ id, status: 'collected' }));
	});

	it('hides the order from staff at another lab, who can neither see nor act on it', async () => {
		const id = await order();
		expect((await ok(users.otherLab.cookie, WORKLIST, { status: 'sent' })).labOrders).toEqual([]);
		expect(await errorOf(users.otherLab.cookie, ACCEPT, { id })).toMatchObject({ code: 'NOT_FOUND' });
		expect(
			await errorOf(users.otherLab.cookie, REJECT, { input: { orderId: id, reason: 'Not ours' } }),
		).toMatchObject({ code: 'NOT_FOUND' });
		expect(await prisma.clinicalOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'sent' });
	});

	it('lets only the receiving facility take lab steps, and only the ordering doctor cancel', async () => {
		const id = await order();
		// Dr. Reyes sees the order (her patient) but is not lab staff.
		expect(await errorOf(users.reyes.cookie, ACCEPT, { id })).toMatchObject({ code: 'FORBIDDEN' });
		// A colleague with the same patient is not the ordering doctor; the lab can't cancel for the doctor.
		expect(await errorOf(users.lim.cookie, CANCEL, { input: { orderId: id, reason: 'x' } })).toMatchObject({
			code: 'FORBIDDEN',
		});
		expect(await errorOf(users.bautista.cookie, CANCEL, { input: { orderId: id, reason: 'x' } })).toMatchObject({
			code: 'FORBIDDEN',
		});
		const { cancelOrder } = await ok(users.reyes.cookie, CANCEL, {
			input: { orderId: id, reason: 'Patient had it done last week' },
		});
		expect(cancelOrder).toMatchObject({ status: 'cancelled', statusReason: 'Patient had it done last week' });
		expect(await audits('order.cancel', id)).toEqual([
			expect.objectContaining({ userId: users.reyes.id, reason: 'Patient had it done last week' }),
		]);
	});

	it('refuses invalid transitions in the API and in Postgres', async () => {
		const id = await order();
		// Collected before accepted.
		expect(await errorOf(users.bautista.cookie, COLLECT, { id })).toMatchObject({
			code: 'CONFLICT',
			message: "This order is sent; it can't be collected now.",
		});
		const { rejectOrder } = await ok(users.bautista.cookie, REJECT, {
			input: { orderId: id, reason: 'Test not offered' },
		});
		expect(rejectOrder).toMatchObject({ status: 'rejected', statusReason: 'Test not offered' });
		expect(rejectOrder.closedAt).toBeTruthy();
		expect(await audits('order.reject', id)).toHaveLength(1);
		// A rejected order is closed.
		expect(await errorOf(users.bautista.cookie, ACCEPT, { id })).toMatchObject({ code: 'CONFLICT' });
		expect(await errorOf(users.reyes.cookie, CANCEL, { input: { orderId: id, reason: 'x' } })).toMatchObject({
			code: 'CONFLICT',
		});
		expect(await errorOf(users.bautista.cookie, REJECT, { input: { orderId: id, reason: ' ' } })).toMatchObject({
			code: 'BAD_REQUEST',
		});
		// The trigger refuses the same edge for system work, which RLS does not restrict.
		await expect(prisma.clinicalOrder.update({ where: { id }, data: { status: 'accepted' } })).rejects.toThrow(
			/cannot go from rejected to accepted/,
		);
	});

	it('moves to resulted and reviewed through the methods the results module calls', async () => {
		const id = await order();
		const orders = app.get(OrderService);
		const db = app.get(ClinicalDbService);
		expect(await db.asSystem((tx) => orders.setResulted(tx, id))).toBe(true);
		// A second result on an order awaiting review changes nothing.
		expect(await db.asSystem((tx) => orders.setResulted(tx, id))).toBe(false);
		expect(await audits('order.result', id)).toEqual([
			expect.objectContaining({ userId: null, orgId: facilities.lab, origin: { via: 'hl7' } }),
		]);
		expect(await db.asUser(users.reyes.id, (tx) => orders.setReviewed(tx, id))).toBe(true);
		expect(await prisma.clinicalOrder.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'reviewed' });
		expect(await audits('order.review', id)).toEqual([expect.objectContaining({ userId: users.reyes.id })]);
		// A late result reopens review; a cancelled order keeps its status.
		expect(await db.asSystem((tx) => orders.setResulted(tx, id))).toBe(true);
		const cancelled = await order();
		await ok(users.reyes.cookie, CANCEL, { input: { orderId: cancelled, reason: 'Duplicate' } });
		expect(await db.asSystem((tx) => orders.setResulted(tx, cancelled))).toBe(false);
	});

	it('applies ORM/OML status updates from the lab system of the receiving facility only', async () => {
		const id = await order();
		const orders = app.get(OrderService);
		const db = app.get(ClinicalDbService);
		const update = (orgId: string, orderStatus: string) =>
			db.asSystem((tx) =>
				orders.applyLabStatus(tx, orgId, { placerOrderId: id, orderControl: 'SC', orderStatus }),
			);
		expect(await update(facilities.otherLab, 'IP')).toBeNull();
		// "Collected" straight from "sent" takes both steps.
		expect(await update(facilities.lab, 'CM')).toMatchObject({ status: 'collected' });
		expect(await audits('order.accept', id)).toHaveLength(1);
		expect(await audits('order.collect', id)).toHaveLength(1);
		// A repeat is a no-op.
		expect(await update(facilities.lab, 'CM')).toMatchObject({ status: 'collected' });
		expect(await audits('order.collect', id)).toHaveLength(1);
	});

	describe('outbound HL7', () => {
		it('queues an ORM^O01 only for a facility that uses the connector', async () => {
			const plain = await order(facilities.lab);
			expect(await prisma.hl7Outbox.count({ where: { orderId: plain } })).toBe(0);

			const id = await order(facilities.connectorLab);
			const [row] = await prisma.hl7Outbox.findMany({ where: { orderId: id } });
			expect(row).toMatchObject({ orgId: facilities.connectorLab, status: 'pending', messageType: 'ORM^O01' });
			const segments = row.message.split('\r');
			expect(segments[0]).toMatch(/^MSH\|\^~\\&\|LOOPWISE\|hc\|\|clab\|/);
			expect(segments[0].split('|')[9]).toBe(row.controlId);
			expect(row.controlId.length).toBeLessThanOrEqual(20);
			expect(segments[1]).toContain('|CL-42^^^clab^MR~HC-0001^^^hc^MR~');
			expect(segments.find((line) => line.startsWith('ORC|'))).toMatch(
				new RegExp(`^ORC\\|NW\\|${id}\\^LOOPWISE`),
			);
			expect(segments.find((line) => line.startsWith('OBR|'))).toContain('|4548-4^Hemoglobin A1c^LN|');
		});

		it('hands each facility only its own pending messages, and marks them delivered on ACK', async () => {
			const outbox = app.get(Hl7OutboxService);
			const id = await order(facilities.connectorLab, '1558-6');
			expect(await outbox.pending(facilities.otherLab)).toEqual([]);
			const pending = await outbox.pending(facilities.connectorLab);
			expect(pending.length).toBeGreaterThanOrEqual(1);
			const mine = pending.find((message) => message.message.includes(`${id}^LOOPWISE`));
			expect(mine).toBeDefined();

			// Another facility can't acknowledge it.
			await expect(outbox.ack(facilities.otherLab, mine!.id, 'AA', null)).rejects.toThrow('Message not found.');
			await expect(outbox.ack(facilities.connectorLab, mine!.id, 'XX', null)).rejects.toThrow(/AA, AE or AR/);
			expect(await outbox.ack(facilities.connectorLab, mine!.id, 'AA', 'MSH|...\rMSA|AA|x')).toEqual({
				id: mine!.id,
				status: 'delivered',
			});
			const row = await prisma.hl7Outbox.findUniqueOrThrow({ where: { id: mine!.id } });
			expect(row).toMatchObject({ status: 'delivered', ackCode: 'AA', attempts: 1 });
			expect(row.ackedAt).toBeTruthy();
			expect((await outbox.pending(facilities.connectorLab)).map((message) => message.id)).not.toContain(
				mine!.id,
			);

			// AE marks the message failed; a later ACK leaves it as it is.
			const failing = await order(facilities.connectorLab, '3084-1');
			const next = (await outbox.pending(facilities.connectorLab)).find((message) =>
				message.message.includes(`${failing}^LOOPWISE`),
			);
			expect(await outbox.ack(facilities.connectorLab, next!.id, 'AE', null)).toMatchObject({ status: 'failed' });
			expect(await outbox.ack(facilities.connectorLab, next!.id, 'AA', null)).toMatchObject({ status: 'failed' });
		});

		it('serves the outbox over REST to the facility key of the connector, and takes its ACK', async () => {
			const keys = app.get(FacilityKeyService);
			const { key } = await keys.create(facilities.connectorLab, users.bautista.id, 'Connector');
			const { key: otherKey } = await keys.create(facilities.otherLab, users.otherLab.id, 'Other connector');
			const http = () => request(app.getHttpServer());
			const id = await order(facilities.connectorLab, '57698-3');

			await http().get('/api/hl7/outbox').expect(401);
			expect(
				(await http().get('/api/hl7/outbox').set('Authorization', `Bearer ${otherKey}`).expect(200)).body,
			).toEqual([]);
			const res = await http().get('/api/hl7/outbox?limit=50').set('Authorization', `Bearer ${key}`).expect(200);
			const mine = (res.body as { id: string; message: string }[]).find((message) =>
				message.message.includes(`${id}^LOOPWISE`),
			);
			expect(mine).toEqual({ id: expect.any(String), message: expect.stringMatching(/^MSH\|/) });

			await http()
				.post(`/api/hl7/outbox/${mine!.id}/ack`)
				.set('Authorization', `Bearer ${otherKey}`)
				.send({ code: 'AA' })
				.expect(404);
			await http()
				.post(`/api/hl7/outbox/${mine!.id}/ack`)
				.set('Authorization', `Bearer ${key}`)
				.send({ code: 'NOPE' })
				.expect(400);
			const acked = await http()
				.post(`/api/hl7/outbox/${mine!.id}/ack`)
				.set('Authorization', `Bearer ${key}`)
				.send({ code: 'AA', ack: 'MSH|^~\\&|LIS\rMSA|AA|x' })
				.expect(200);
			expect(acked.body).toEqual({ id: mine!.id, status: 'delivered' });
			expect(await prisma.hl7Outbox.findUniqueOrThrow({ where: { id: mine!.id } })).toMatchObject({
				status: 'delivered',
				ackCode: 'AA',
			});
		});

		it('queues an ORC CA when the doctor cancels an order the connector already has', async () => {
			const id = await order(facilities.connectorLab, '2160-0');
			await ok(users.reyes.cookie, CANCEL, { input: { orderId: id, reason: 'Duplicate' } });
			const messages = await prisma.hl7Outbox.findMany({ where: { orderId: id }, orderBy: { createdAt: 'asc' } });
			expect(messages.map((row) => row.message.split('\r')[3].split('|')[1])).toEqual(['NW', 'CA']);
		});
	});
});
