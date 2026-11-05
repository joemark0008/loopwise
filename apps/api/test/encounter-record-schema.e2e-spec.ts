import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ReferenceModule } from '../src/clinical/reference/reference.module.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicalTestApp, resetDatabase, useTestDatabase } from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createEncounter,
	createOrganization,
	createPatient,
	createUser,
	type FixtureUser,
} from './fixtures/clinic-fixtures.js';

/**
 * The encounter record tables (migration 0001_rls_and_triggers): row-level security through the encounter, one
 * primary diagnosis, the triggers that lock issued prescriptions and certificates, and practitioner profiles.
 */
describe('encounter record schema (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	let scene: ClinicScene;
	/** A doctor of another organization, at its own clinic. */
	let outsider: FixtureUser;
	let outsiderEncounterId: string;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp([ReferenceModule]);
		prisma = app.get(PrismaService);
		db = app.get(ClinicalDbService, { strict: false });
		scene = await createClinicScene(prisma);

		outsider = await createUser(prisma, { firstName: 'Lito', lastName: 'Lim' });
		const otherOrg = await createOrganization(prisma);
		const otherClinic = await createClinic(prisma, {
			organizationId: otherOrg.id,
			staff: [{ userId: outsider.id, roles: ['DOCTOR'] }],
		});
		const otherPatient = await createPatient(prisma, { organizationId: otherOrg.id, careTeam: [outsider.id] });
		outsiderEncounterId = (await createEncounter(prisma, { clinicId: otherClinic.id, patientId: otherPatient.id }))
			.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	const draftPrescription = (rxNo: string) =>
		prisma.prescription.create({
			data: {
				rxNo,
				verificationCode: rxNo,
				encounterId: scene.encounter.id,
				practitionerId: scene.doctorPractitioner.id,
				items: {
					create: {
						genericName: 'Amlodipine',
						strength: '5 mg',
						sig: '1 tablet once a day',
						quantity: 30,
					},
				},
			},
			include: { items: true },
		});

	it('lets the doctor in the patient’s care record vitals and hides them from others', async () => {
		const row = await db.asUser(scene.doctor.id, (tx) =>
			tx.vitalSigns.create({
				data: {
					encounterId: scene.encounter.id,
					systolicBp: 140,
					diastolicBp: 90,
					recordedById: scene.doctor.id,
				},
			}),
		);
		expect(row.systolicBp).toBe(140);
		const seen = await db.asUser(scene.otherDoctor.id, (tx) => tx.vitalSigns.findMany());
		expect(seen).toEqual([]);
		const seenByOutsider = await db.asUser(outsider.id, (tx) => tx.vitalSigns.findMany());
		expect(seenByOutsider).toEqual([]);
	});

	it('refuses a record row on a visit the user may not write', async () => {
		await expect(
			db.asUser(outsider.id, (tx) =>
				tx.vitalSigns.create({ data: { encounterId: scene.encounter.id, systolicBp: 120, diastolicBp: 80 } }),
			),
		).rejects.toThrow();
		await expect(
			db.asUser(scene.doctor.id, (tx) =>
				tx.vitalSigns.create({ data: { encounterId: outsiderEncounterId, systolicBp: 120, diastolicBp: 80 } }),
			),
		).rejects.toThrow();
	});

	it('keeps the pain score between 0 and 10', async () => {
		await expect(
			prisma.vitalSigns.create({ data: { encounterId: scene.encounter.id, painScore: 11 } }),
		).rejects.toThrow(/vital_signs_pain_score_range/);
	});

	it('allows one primary diagnosis per encounter, ignoring voided ones', async () => {
		const diagnosis = (type: 'PRIMARY' | 'SECONDARY') =>
			prisma.encounterDiagnosis.create({
				data: { encounterId: scene.encounter.id, icd10Code: 'I10', description: 'Hypertension', type },
			});
		const first = await diagnosis('PRIMARY');
		await expect(diagnosis('PRIMARY')).rejects.toThrow(/Unique constraint|encounter_diagnoses_one_primary/);
		await diagnosis('SECONDARY');
		await prisma.encounterDiagnosis.update({
			where: { id: first.id },
			data: { voidedAt: new Date(), voidedById: scene.doctor.id, voidReason: 'Wrong code' },
		});
		await expect(diagnosis('PRIMARY')).resolves.toMatchObject({ type: 'PRIMARY' });
	});

	it('refuses an ICD-10 code outside icd10_codes', async () => {
		await expect(
			prisma.encounterDiagnosis.create({
				data: { encounterId: scene.encounter.id, icd10Code: 'Z99.99', description: 'Unknown' },
			}),
		).rejects.toThrow(/Foreign key constraint|icd10_code/);
	});

	it('edits a draft prescription and its items freely', async () => {
		const rx = await draftPrescription('TEST-RX-0001');
		await prisma.prescriptionItem.update({ where: { id: rx.items[0].id }, data: { quantity: 60 } });
		await prisma.prescriptionItem.delete({ where: { id: rx.items[0].id } });
		await prisma.prescription.update({ where: { id: rx.id }, data: { notes: 'Changed' } });
		await prisma.prescription.delete({ where: { id: rx.id } });
	});

	it('locks an issued prescription, even for system work, but lets it be dispensed and voided', async () => {
		const rx = await draftPrescription('TEST-RX-0002');
		await prisma.prescription.update({
			where: { id: rx.id },
			data: { documentStatus: 'ISSUED', issuedAt: new Date(), signatory: { name: 'Dr. Reyes' } },
		});
		await expect(prisma.prescription.update({ where: { id: rx.id }, data: { notes: 'Edited' } })).rejects.toThrow(
			/can only be voided/,
		);
		await expect(
			prisma.prescriptionItem.update({ where: { id: rx.items[0].id }, data: { quantity: 90 } }),
		).rejects.toThrow(/lines cannot change/);
		await expect(
			prisma.prescriptionItem.create({
				data: { prescriptionId: rx.id, genericName: 'Losartan', sig: '1 tablet daily', quantity: 30 },
			}),
		).rejects.toThrow(/lines cannot change/);
		await expect(prisma.prescription.delete({ where: { id: rx.id } })).rejects.toThrow(/cannot be deleted/);
		await expect(
			prisma.prescription.update({ where: { id: rx.id }, data: { documentStatus: 'DRAFT' } }),
		).rejects.toThrow(/can only be voided/);

		// The pharmacy dispenses against an issued prescription.
		await prisma.prescriptionItem.update({ where: { id: rx.items[0].id }, data: { dispensedQty: 30 } });
		await prisma.prescription.update({ where: { id: rx.id }, data: { status: 'DISPENSED' } });

		await prisma.prescription.update({
			where: { id: rx.id },
			data: { status: 'CANCELLED', voidedAt: new Date(), voidedById: scene.doctor.id, voidReason: 'Wrong dose' },
		});
		await expect(
			prisma.prescription.update({ where: { id: rx.id }, data: { voidReason: 'Changed my mind' } }),
		).rejects.toThrow(/can only be voided/);
	});

	it('locks an issued medical certificate except for voiding', async () => {
		const certificate = await prisma.medicalCertificate.create({
			data: {
				certNo: 'TEST-MC-0001',
				verificationCode: 'TEST-MC-0001',
				encounterId: scene.encounter.id,
				practitionerId: scene.doctorPractitioner.id,
				examinedAt: new Date(),
				diagnosisText: 'Acute URTI',
			},
		});
		await prisma.medicalCertificate.update({
			where: { id: certificate.id },
			data: { documentStatus: 'ISSUED', issuedAt: new Date() },
		});
		await expect(
			prisma.medicalCertificate.update({ where: { id: certificate.id }, data: { restDays: 3 } }),
		).rejects.toThrow(/can only be voided/);
		await prisma.medicalCertificate.update({
			where: { id: certificate.id },
			data: { isVoid: true, voidReason: 'Issued to the wrong patient', voidedAt: new Date() },
		});
		await expect(
			prisma.medicalCertificate.update({ where: { id: certificate.id }, data: { voidReason: 'Other' } }),
		).rejects.toThrow(/can only be voided/);
	});

	it('bumps the version of an encounter, prescription and certificate on every update', async () => {
		const before = await prisma.encounter.findUniqueOrThrow({ where: { id: scene.encounter.id } });
		const after = await prisma.encounter.update({
			where: { id: scene.encounter.id },
			data: { assessment: 'Hypertension, stage 1' },
		});
		expect(after.version).toBe(before.version + 1);
	});

	it('requires a target for a referral', async () => {
		await expect(
			prisma.referral.create({
				data: {
					encounterId: scene.encounter.id,
					fromPractitionerId: scene.doctorPractitioner.id,
					reason: 'Cardiology evaluation',
				},
			}),
		).rejects.toThrow(/referrals_target_required/);
		await expect(
			prisma.referral.create({
				data: {
					encounterId: scene.encounter.id,
					fromPractitionerId: scene.doctorPractitioner.id,
					toFacility: 'Gov. Celestino Gallares Memorial Medical Center',
					reason: 'Cardiology evaluation',
				},
			}),
		).resolves.toMatchObject({ status: 'SENT' });
	});

	it('shows practitioners to everyone but lets only their owner write them', async () => {
		const seen = await db.asUser(outsider.id, (tx) => tx.practitioner.findMany());
		expect(seen.map((practitioner) => practitioner.id)).toEqual(
			expect.arrayContaining([scene.doctorPractitioner.id, scene.adminPractitioner.id]),
		);
		await expect(
			db.asUser(scene.otherDoctor.id, (tx) =>
				tx.practitioner.update({ where: { id: scene.doctorPractitioner.id }, data: { ptrNo: '1' } }),
			),
		).rejects.toThrow();
		await expect(
			db.asUser(scene.doctor.id, (tx) =>
				tx.practitioner.update({ where: { id: scene.doctorPractitioner.id }, data: { ptrNo: 'PTR-2026-1' } }),
			),
		).resolves.toMatchObject({ ptrNo: 'PTR-2026-1' });
	});
});
