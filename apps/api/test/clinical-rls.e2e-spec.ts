import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/**
 * Row-level security on the clinical tables (DESIGN.md §8, migration 0006_clinical_rls), through
 * `ClinicalDbService.asUser`. The setup runs as the owner, as system work does.
 */
describe('clinical row-level security (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	const ids = { doctor: '', otherDoctor: '', labUser: '', maria: '', jose: '', marias: '', joses: '', case: '' };

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		db = app.get(ClinicalDbService);

		const password = 'Sup3r-secret!';
		ids.doctor = (await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password })).userId;
		ids.otherDoctor = (await createTestUser(app, { name: 'Dr. Lim', email: 'lim@example.com', password })).userId;
		ids.labUser = (await createTestUser(app, { name: 'Lab Tech', email: 'lab@example.com', password })).userId;

		const clinic = await prisma.organization.create({
			data: { name: 'Health Center', slug: 'hc', type: 'clinic' },
		});
		const otherClinic = await prisma.organization.create({
			data: { name: 'Other Clinic', slug: 'oc', type: 'clinic' },
		});
		const lab = await prisma.organization.create({ data: { name: 'Bohol Lab', slug: 'lab', type: 'lab' } });
		const otherLab = await prisma.organization.create({ data: { name: 'Other Lab', slug: 'lab2', type: 'lab' } });
		await prisma.orgMember.createMany({
			data: [
				{ orgId: clinic.id, userId: ids.doctor, role: 'user' },
				{ orgId: otherClinic.id, userId: ids.otherDoctor, role: 'user' },
				{ orgId: lab.id, userId: ids.labUser, role: 'user' },
			],
		});

		const maria = await prisma.patient.create({
			data: {
				givenName: 'Maria',
				familyName: 'Santos',
				birthDate: new Date('1981-04-12'),
				sex: 'female',
				careRelationships: {
					create: [
						{ userId: ids.doctor, orgId: clinic.id, reason: 'encounter' },
						{
							userId: ids.otherDoctor,
							orgId: otherClinic.id,
							reason: 'break_glass',
							note: 'Emergency',
							expiresAt: new Date(Date.now() - 60_000),
						},
					],
				},
			},
		});
		const jose = await prisma.patient.create({
			data: { givenName: 'Jose', familyName: 'Cruz', birthDate: new Date('1975-01-02'), sex: 'male' },
		});
		ids.maria = maria.id;
		ids.jose = jose.id;

		const order = (patientId: string, targetOrgId: string) =>
			prisma.clinicalOrder.create({
				data: {
					patientId,
					orderingDoctorId: ids.doctor,
					orderingOrgId: clinic.id,
					targetOrgId,
					code: '4548-4',
					status: 'sent',
				},
			});
		ids.marias = (await order(maria.id, lab.id)).id;
		ids.joses = (await order(jose.id, otherLab.id)).id;

		const pathway = await prisma.pathway.create({
			data: { key: 'diabetes', name: 'Diabetes', rules: {}, steps: [], slas: {}, closureRequirements: {} },
		});
		const careCase = await prisma.careCase.create({
			data: {
				patientId: maria.id,
				pathwayId: pathway.id,
				ownerUserId: ids.doctor,
				ownerOrgId: clinic.id,
				events: { create: { type: 'case.opened', toState: 'open', actorType: 'system' } },
			},
		});
		ids.case = careCase.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	const patientsOf = (userId: string) =>
		db.asUser(userId, (tx) => tx.patient.findMany({ select: { id: true } })).then((rows) => rows.map((r) => r.id));

	it('shows a patient to the doctor with a care relationship', async () => {
		expect(await patientsOf(ids.doctor)).toContain(ids.maria);
	});

	it('hides the patient from another doctor, whose break-glass access has expired', async () => {
		expect(await patientsOf(ids.otherDoctor)).toEqual([]);
		const events = await db.asUser(ids.otherDoctor, (tx) => tx.caseEvent.findMany());
		expect(events).toEqual([]);
	});

	it('shows the lab the orders sent to it, and their patient, but not other facilities’ orders', async () => {
		const orders = await db.asUser(ids.labUser, (tx) => tx.clinicalOrder.findMany({ select: { id: true } }));
		expect(orders.map((order) => order.id)).toEqual([ids.marias]);
		expect(await patientsOf(ids.labUser)).toEqual([ids.maria]);
	});

	it('shows case events to whoever can see the case', async () => {
		const events = await db.asUser(ids.doctor, (tx) => tx.caseEvent.findMany({ where: { caseId: ids.case } }));
		expect(events.map((event) => event.type)).toEqual(['case.opened']);
	});

	it('refuses to delete clinical data as a user', async () => {
		await expect(db.asUser(ids.doctor, (tx) => tx.patient.delete({ where: { id: ids.maria } }))).rejects.toThrow(
			/permission denied/,
		);
		expect(await prisma.patient.count({ where: { id: ids.maria } })).toBe(1);
	});

	it('refuses to write a record for a patient the user cannot see', async () => {
		await expect(
			db.asUser(ids.otherDoctor, (tx) =>
				tx.patientMessage.create({
					data: {
						patientId: ids.maria,
						channel: 'sms',
						templateKey: 'invite',
						language: 'en',
						body: 'Please visit the clinic.',
					},
				}),
			),
		).rejects.toThrow(/row-level security/);
	});

	it('lets system work see every patient', async () => {
		const patients = await db.asSystem((tx) => tx.patient.findMany({ select: { id: true } }));
		expect(patients.map((patient) => patient.id).sort()).toEqual([ids.maria, ids.jose].sort());
	});
});
