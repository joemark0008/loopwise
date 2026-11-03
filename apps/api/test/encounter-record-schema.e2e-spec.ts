import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/**
 * The encounter record tables (migration 0011_encounter_record): row-level security through the patient, the
 * (encounter, patient) foreign keys, one primary diagnosis, and the triggers that lock issued documents.
 */
describe('encounter record schema (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	const ids = { doctor: '', otherDoctor: '', clinic: '', otherClinic: '', maria: '', jose: '', visit: '' };

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		db = app.get(ClinicalDbService);

		const password = 'Sup3r-secret!';
		ids.doctor = (await createTestUser(app, { name: 'Dr. Reyes', email: 'reyes@example.com', password })).userId;
		ids.otherDoctor = (await createTestUser(app, { name: 'Dr. Lim', email: 'lim@example.com', password })).userId;
		ids.clinic = (await prisma.organization.create({ data: { name: 'Health Center', slug: 'hc' } })).id;
		ids.otherClinic = (await prisma.organization.create({ data: { name: 'Other Clinic', slug: 'oc' } })).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: ids.clinic, userId: ids.doctor, role: 'user' },
				{ orgId: ids.otherClinic, userId: ids.otherDoctor, role: 'user' },
			],
		});
		const patient = (givenName: string) =>
			prisma.patient.create({
				data: {
					givenName,
					familyName: 'Santos',
					birthDate: new Date('1981-04-12'),
					sex: 'female',
					careRelationships: { create: { userId: ids.doctor, orgId: ids.clinic, reason: 'encounter' } },
				},
			});
		ids.maria = (await patient('Maria')).id;
		ids.jose = (await patient('Jose')).id;
		ids.visit = (
			await prisma.encounter.create({
				data: { patientId: ids.maria, doctorId: ids.doctor, orgId: ids.clinic, reason: 'Fatigue' },
			})
		).id;
	});

	afterAll(async () => {
		await app?.close();
	});

	const vitals = (patientId: string, orgId = ids.clinic) => ({
		encounterId: ids.visit,
		patientId,
		orgId,
		systolicMmHg: 140,
		diastolicMmHg: 90,
		recordedById: ids.doctor,
	});

	const draftPrescription = () =>
		prisma.prescription.create({
			data: {
				encounterId: ids.visit,
				patientId: ids.maria,
				orgId: ids.clinic,
				prescriberId: ids.doctor,
				items: {
					create: {
						genericName: 'Amlodipine',
						strength: '5 mg',
						dose: '1 tablet',
						frequency: 'once a day',
						quantity: 30,
					},
				},
			},
			include: { items: true },
		});

	it('lets the doctor in the patient’s care record vitals and hides them from others', async () => {
		const row = await db.asUser(ids.doctor, (tx) => tx.vitalSigns.create({ data: vitals(ids.maria) }));
		expect(row.systolicMmHg).toBe(140);
		const seen = await db.asUser(ids.otherDoctor, (tx) => tx.vitalSigns.findMany());
		expect(seen).toEqual([]);
	});

	it('refuses a record row written at a facility the user does not work at', async () => {
		await expect(
			db.asUser(ids.doctor, (tx) => tx.vitalSigns.create({ data: vitals(ids.maria, ids.otherClinic) })),
		).rejects.toThrow(/row-level security/);
	});

	it('refuses a row whose patient is not the encounter’s patient', async () => {
		await expect(prisma.vitalSigns.create({ data: vitals(ids.jose) })).rejects.toThrow(/Foreign key constraint/);
	});

	it('allows one primary diagnosis per encounter, ignoring voided ones', async () => {
		const diagnosis = (isPrimary: boolean) => ({
			encounterId: ids.visit,
			patientId: ids.maria,
			orgId: ids.clinic,
			icd10Code: 'I10',
			display: 'Essential (primary) hypertension',
			isPrimary,
			recordedById: ids.doctor,
		});
		const first = await prisma.encounterDiagnosis.create({ data: diagnosis(true) });
		await expect(prisma.encounterDiagnosis.create({ data: diagnosis(true) })).rejects.toThrow(/Unique constraint/);
		await prisma.encounterDiagnosis.update({ where: { id: first.id }, data: { voidedAt: new Date() } });
		await expect(prisma.encounterDiagnosis.create({ data: diagnosis(true) })).resolves.toBeTruthy();
	});

	it('edits a draft prescription and its items freely', async () => {
		const rx = await draftPrescription();
		await prisma.prescriptionItem.update({ where: { id: rx.items[0].id }, data: { quantity: 60 } });
		await prisma.prescriptionItem.delete({ where: { id: rx.items[0].id } });
		await prisma.prescription.update({ where: { id: rx.id }, data: { notes: 'Changed' } });
		await prisma.prescription.delete({ where: { id: rx.id } });
	});

	it('locks an issued prescription, even for system work, but lets it be voided', async () => {
		const rx = await draftPrescription();
		await prisma.prescription.update({
			where: { id: rx.id },
			data: { status: 'issued', issuedAt: new Date(), rxNumber: `RX-TEST-${rx.id.slice(0, 6)}` },
		});
		await expect(prisma.prescription.update({ where: { id: rx.id }, data: { notes: 'Edited' } })).rejects.toThrow(
			/can only be voided/,
		);
		await expect(
			prisma.prescriptionItem.update({ where: { id: rx.items[0].id }, data: { quantity: 90 } }),
		).rejects.toThrow(/lines cannot change/);
		await expect(
			prisma.prescriptionItem.create({
				data: {
					prescriptionId: rx.id,
					genericName: 'Losartan',
					dose: '1 tablet',
					frequency: 'daily',
					quantity: 30,
				},
			}),
		).rejects.toThrow(/lines cannot change/);
		await expect(prisma.prescription.delete({ where: { id: rx.id } })).rejects.toThrow(/cannot be deleted/);
		await expect(prisma.prescription.update({ where: { id: rx.id }, data: { status: 'draft' } })).rejects.toThrow(
			/can only be voided/,
		);

		await prisma.prescription.update({
			where: { id: rx.id },
			data: { status: 'voided', voidedAt: new Date(), voidedById: ids.doctor, voidReason: 'Wrong dose' },
		});
		await expect(
			prisma.prescription.update({ where: { id: rx.id }, data: { voidReason: 'Changed my mind' } }),
		).rejects.toThrow(/can only be voided/);
	});

	it('lets a finalized bill be marked paid, and nothing else', async () => {
		const bill = await prisma.encounterBill.create({
			data: {
				encounterId: ids.visit,
				patientId: ids.maria,
				orgId: ids.clinic,
				subtotal: 300,
				total: 300,
				charges: {
					create: { kind: 'consultation', description: 'Consultation', unitPrice: 300, amount: 300 },
				},
			},
		});
		await prisma.encounterBill.update({
			where: { id: bill.id },
			data: { status: 'finalized', finalizedAt: new Date() },
		});
		await expect(prisma.encounterBill.update({ where: { id: bill.id }, data: { total: 0 } })).rejects.toThrow(
			/can only be voided/,
		);
		await prisma.encounterBill.update({
			where: { id: bill.id },
			data: { status: 'paid', paidAt: new Date(), orNumber: 'OR-0001' },
		});
		expect((await prisma.encounterBill.findUniqueOrThrow({ where: { id: bill.id } })).status).toBe('paid');
	});

	it('shows clinician profiles to everyone but lets only their owner write them', async () => {
		await db.asUser(ids.doctor, (tx) =>
			tx.clinicianProfile.create({ data: { userId: ids.doctor, prcLicenseNumber: '0000000' } }),
		);
		const seen = await db.asUser(ids.otherDoctor, (tx) => tx.clinicianProfile.findMany());
		expect(seen.map((profile) => profile.userId)).toEqual([ids.doctor]);
		await expect(
			db.asUser(ids.otherDoctor, (tx) =>
				tx.clinicianProfile.update({ where: { userId: ids.doctor }, data: { prcLicenseNumber: '1' } }),
			),
		).rejects.toThrow();
	});
});
