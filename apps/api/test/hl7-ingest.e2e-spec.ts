import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type ClinicalEvents, ClinicalEventsService } from '../src/clinical/events/clinical-events.service.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { FacilityKeyService } from '../src/facility-keys/facility-key.service.js';
import { component, field, findSegment, parseHl7 } from '../src/hl7/hl7-parser.js';
import { sampleOru } from '../src/hl7/oru-samples.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/**
 * `POST /api/hl7/messages` (DESIGN.md §4.3, §9): facility-key auth, ACK codes, idempotency per MSH-10, deterministic
 * patient matching, stored results with the order moved to `resulted`, audit rows and the `result.received` event.
 */
describe('HL7 ingest (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let labKey = '';
	let otherLabKey = '';
	const ids = { reyes: '', cruz: '', clinic: '', lab: '', otherLab: '', maria: '', pedro: '', order: '' };
	const received: ClinicalEvents['result.received'][] = [];

	const post = (body: string, key = labKey, contentType = 'text/plain') =>
		request(app.getHttpServer())
			.post('/api/hl7/messages')
			.set('Authorization', `Bearer ${key}`)
			.set('Content-Type', contentType)
			.send(body);

	const msa = (ack: string) => {
		const segment = findSegment(parseHl7(ack), 'MSA');
		return { code: field(segment, 1), controlId: field(segment, 2), text: field(segment, 3) };
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		app.get(ClinicalEventsService).on('result.received', (event) => {
			received.push(event);
		});

		const password = 'Sup3r-secret!';
		const reyes = await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password });
		const cruz = await createTestUser(app, { name: 'Dr. Cruz', email: 'cruz@example.com', password });
		ids.reyes = reyes.userId;
		ids.cruz = cruz.userId;

		const org = (name: string, slug: string, type: 'clinic' | 'lab') =>
			prisma.organization.create({ data: { name, slug, type } }).then((row) => row.id);
		ids.clinic = await org('Health Center', 'hc', 'clinic');
		ids.lab = await org('Diagnostics Lab', 'lab', 'lab');
		ids.otherLab = await org('Other Lab', 'other-lab', 'lab');
		const otherClinic = await org('Other Clinic', 'oc', 'clinic');
		await prisma.orgMember.createMany({
			data: [
				{ orgId: ids.clinic, userId: ids.reyes, role: 'user' },
				{ orgId: otherClinic, userId: ids.cruz, role: 'user' },
			],
		});

		const patient = (givenName: string, number: string, birthDate: string) =>
			prisma.patient
				.create({
					data: {
						givenName,
						familyName: 'Santos',
						birthDate: new Date(birthDate),
						sex: 'female',
						identifiers: {
							create: [
								{ orgId: ids.clinic, system: 'MRN', value: `THC-${number}` },
								{ orgId: ids.clinic, system: 'PhilHealth', value: `SYN-0000-${number}` },
							],
						},
						careRelationships: { create: [{ userId: ids.reyes, orgId: ids.clinic, reason: 'encounter' }] },
					},
				})
				.then((row) => row.id);
		ids.maria = await patient('Maria', '0001', '1981-04-12');
		ids.pedro = await patient('Pedro', '0002', '1970-01-01');
		ids.order = (
			await prisma.clinicalOrder.create({
				data: {
					patientId: ids.maria,
					orderingDoctorId: ids.reyes,
					orderingOrgId: ids.clinic,
					targetOrgId: ids.lab,
					code: '4548-4',
					display: 'Hemoglobin A1c',
					status: 'collected',
					sentAt: new Date(),
				},
			})
		).id;

		const keys = app.get(FacilityKeyService);
		labKey = (await keys.create(ids.lab, ids.reyes, 'LIS')).key;
		otherLabKey = (await keys.create(ids.otherLab, ids.reyes, 'LIS')).key;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('answers 401 without a valid facility key', async () => {
		await post(sampleOru(), 'lw_not-a-key').expect(401);
		await request(app.getHttpServer()).post('/api/hl7/messages').send(sampleOru()).expect(401);
		expect(await prisma.hl7Message.count()).toBe(0);
	});

	it("stores Maria's HbA1c, links the order and answers AA", async () => {
		const res = await post(sampleOru({ controlId: 'MSG-1', placerOrderNumber: ids.order })).expect(200);
		expect(res.headers['content-type']).toMatch(/^text\/plain/);
		expect(msa(res.text)).toEqual({ code: 'AA', controlId: 'MSG-1', text: '' });
		expect(component(findSegment(parseHl7(res.text), 'MSH'), 9, 1)).toBe('ACK');

		const results = await prisma.result.findMany({ where: { patientId: ids.maria } });
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			orderId: ids.order,
			sourceOrgId: ids.lab,
			code: '4548-4',
			value: '7.2',
			unit: '%',
			refRange: '4.0-5.6',
			flag: 'high',
			reviewedAt: null,
		});
		expect(Number(results[0].valueNumeric)).toBe(7.2);
		expect(results[0].rawHl7).toContain('MSG-1');
		expect((await prisma.clinicalOrder.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe('resulted');

		const audit = await prisma.auditLog.findMany({ where: { action: 'result.receive' } });
		expect(audit).toEqual([
			expect.objectContaining({
				userId: null,
				orgId: ids.lab,
				patientId: ids.maria,
				resourceId: results[0].id,
				origin: { via: 'hl7', controlId: 'MSG-1', messageType: 'ORU^R01' },
			}),
		]);
		expect(received).toEqual([{ resultId: results[0].id, patientId: ids.maria, orderId: ids.order }]);
		expect(await prisma.hl7Message.findFirst({ where: { controlId: 'MSG-1' } })).toMatchObject({
			orgId: ids.lab,
			status: 'accepted',
			ackCode: 'AA',
			ack: res.text,
			patientId: ids.maria,
			resultIds: [results[0].id],
		});
	});

	it('answers a resent MSH-10 with the same ACK and stores nothing twice', async () => {
		const first = await prisma.hl7Message.findFirstOrThrow({ where: { controlId: 'MSG-1' } });
		const again = await post(sampleOru({ controlId: 'MSG-1', placerOrderNumber: ids.order })).expect(200);
		const concurrent = await Promise.all(
			[0, 1, 2].map(() => post(sampleOru({ controlId: 'MSG-RACE', value: '6.0', flag: 'H' }))),
		);
		expect(again.text).toBe(first.ack);
		expect(new Set(concurrent.map((res) => res.text)).size).toBe(1);
		expect(concurrent.every((res) => res.status === 200 && msa(res.text).code === 'AA')).toBe(true);
		expect(await prisma.hl7Message.count({ where: { controlId: { in: ['MSG-1', 'MSG-RACE'] } } })).toBe(2);
		expect(await prisma.result.count({ where: { patientId: ids.maria } })).toBe(2);
		expect(received).toHaveLength(2);
	});

	it('keys idempotency by facility: another lab may reuse a control id', async () => {
		const res = await post(sampleOru({ controlId: 'MSG-1', value: '5.1', flag: 'N' }), otherLabKey).expect(200);
		expect(msa(res.text).code).toBe('AA');
		const fromOther = await prisma.result.findFirstOrThrow({ where: { sourceOrgId: ids.otherLab } });
		// Not sent to this lab: the order is not linked, even by test code.
		expect(fromOther.orderId).toBeNull();
	});

	it('matches by an identifier the lab issued, then by PhilHealth, then by the order', async () => {
		await prisma.patientIdentifier.create({
			data: { patientId: ids.pedro, orgId: ids.lab, system: 'LAB', value: 'L-77' },
		});
		const byLab = await post(
			sampleOru({
				controlId: 'MSG-LAB',
				identifiers: ['L-77^^^LAB^PI'],
				birthDate: '19700101',
				givenName: 'Pedro',
			}),
		);
		expect(msa(byLab.text).code).toBe('AA');
		expect(await prisma.result.count({ where: { patientId: ids.pedro } })).toBe(1);

		const byOrder = await post(
			sampleOru({ controlId: 'MSG-ORDER', identifiers: ['UNKNOWN-1^^^XYZ^MR'], placerOrderNumber: ids.order }),
		);
		expect(msa(byOrder.text).code).toBe('AA');
		expect(await prisma.result.count({ where: { orderId: ids.order } })).toBe(2);
	});

	it('answers AE for an unmatched patient and keeps the message for review', async () => {
		const res = await post(
			sampleOru({ controlId: 'MSG-NOBODY', identifiers: ['X-1^^^XYZ^MR', 'SYN-9999^^^PhilHealth^NH'] }),
		);
		expect(res.status).toBe(200);
		expect(msa(res.text)).toMatchObject({ code: 'AE', controlId: 'MSG-NOBODY' });
		expect(msa(res.text).text).toMatch(/No patient matches/);
		expect(await prisma.hl7Message.findFirst({ where: { controlId: 'MSG-NOBODY' } })).toMatchObject({
			status: 'error',
			ackCode: 'AE',
			patientId: null,
			error: expect.stringMatching(/No patient matches/),
		});

		const wrongBirth = await post(sampleOru({ controlId: 'MSG-DOB', birthDate: '19990101' }));
		expect(msa(wrongBirth.text).text).toMatch(/date of birth/);

		const conflict = await post(
			sampleOru({
				controlId: 'MSG-CONFLICT',
				identifiers: ['SYN-0000-0002^^^PhilHealth^NH'],
				birthDate: '',
				placerOrderNumber: ids.order,
			}),
		);
		expect(msa(conflict.text).text).toMatch(/not the patient of the referenced order/);
		expect(await prisma.result.count({ where: { patientId: ids.pedro } })).toBe(1);
	});

	it('answers AR for messages it does not take, and AE for a broken ORU', async () => {
		const adt = await post(sampleOru({ controlId: 'MSG-ADT' }).replace('ORU^R01^ORU_R01', 'ADT^A01'));
		expect(msa(adt.text)).toMatchObject({ code: 'AR', controlId: 'MSG-ADT' });
		const garbage = await post('hello');
		expect(msa(garbage.text)).toMatchObject({ code: 'AR', controlId: '' });
		const broken = await post(
			sampleOru({ controlId: 'MSG-CE' }).replace('|NM|', '|CE|'),
			labKey,
			'application/hl7-v2',
		);
		expect(msa(broken.text)).toMatchObject({ code: 'AE', controlId: 'MSG-CE' });
		expect(await prisma.hl7Message.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } })).toEqual([
			{ status: 'accepted', _count: 5 },
			{ status: 'error', _count: 4 },
			{ status: 'rejected', _count: 2 },
		]);
	});

	it('applies ORM/OML status updates from the lab to our orders (accepted, collected)', async () => {
		const sent = await prisma.clinicalOrder.create({
			data: {
				patientId: ids.maria,
				orderingDoctorId: ids.reyes,
				orderingOrgId: ids.clinic,
				targetOrgId: ids.lab,
				code: '1558-6',
				display: 'Fasting glucose',
				status: 'sent',
				sentAt: new Date(),
			},
		});
		const orm = (controlId: string, orc: string, type = 'ORM^O01') =>
			[
				`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|HUB|20261106093000+0800||${type}|${controlId}|P|2.5.1`,
				'PID|1||SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F',
				orc,
			].join('\r');

		const collected = await post(orm('ST-COLLECT', `ORC|SC|${sent.id}|ACC-9||CM`, 'OML^O21'));
		expect(msa(collected.text)).toEqual({ code: 'AA', controlId: 'ST-COLLECT', text: '' });
		expect((await prisma.clinicalOrder.findUniqueOrThrow({ where: { id: sent.id } })).status).toBe('collected');

		const notOurs = await post(orm('ST-OTHER', `ORC|SC|${sent.id}|ACC-9||IP`), otherLabKey);
		expect(msa(notOurs.text).code).toBe('AE');
		expect(msa(notOurs.text).text).toMatch(/not sent to this facility/);

		const unknown = await post(orm('ST-UNKNOWN', 'ORC|SC|LIS-ORDER-77||IP'));
		expect(msa(unknown.text)).toMatchObject({ code: 'AE', text: expect.stringMatching(/not a Loopwise order/) });
		expect((await prisma.clinicalOrder.findUniqueOrThrow({ where: { id: sent.id } })).status).toBe('collected');
	});

	it("keeps the result from another facility's doctor (row-level security)", async () => {
		const db = app.get(ClinicalDbService);
		const visibleTo = (userId: string) =>
			db.asUser(userId, (tx) => tx.result.count({ where: { patientId: ids.maria } }));
		expect(await visibleTo(ids.reyes)).toBe(4);
		expect(await visibleTo(ids.cruz)).toBe(0);
		// And nobody reads the raw log through the app role.
		await expect(db.asUser(ids.reyes, (tx) => tx.hl7Message.count())).rejects.toThrow(/permission denied/);
	});
});
