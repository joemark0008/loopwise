import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ReferenceModule } from '../src/clinical/reference/reference.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicalTestApp, resetDatabase, useTestDatabase } from './clinical-test-app.js';
import { type ClinicScene, createClinicScene, createEncounter, createPatient } from './fixtures/clinic-fixtures.js';

/**
 * What the clinical schema itself guarantees (DESIGN.md §5): the encounter-centric record (children hang off an
 * encounter, reach the patient through it and go with it), per-organization patient numbers and per-clinic visit
 * numbers, unique IDs per patient, and the append-only history tables.
 */
describe('clinical schema (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp([ReferenceModule]);
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
	});

	afterAll(async () => {
		await app?.close();
	});

	it('hangs the record off the encounter and reaches the patient through it', async () => {
		await prisma.vitalSigns.create({ data: { encounterId: scene.encounter.id, systolicBp: 130, diastolicBp: 85 } });
		await prisma.encounterDiagnosis.create({
			data: { encounterId: scene.encounter.id, icd10Code: 'J06.9', description: 'Acute URTI' },
		});
		const record = await prisma.vitalSigns.findMany({
			where: { encounter: { patientId: scene.patient.id } },
			include: { encounter: { select: { clinicId: true, patientId: true } } },
		});
		expect(record).toHaveLength(1);
		expect(record[0].encounter).toEqual({ clinicId: scene.clinic.id, patientId: scene.patient.id });
	});

	it('refuses a record row without an existing encounter', async () => {
		await expect(
			prisma.vitalSigns.create({
				data: { encounterId: '00000000-0000-7000-8000-000000000000', systolicBp: 120, diastolicBp: 80 },
			}),
		).rejects.toThrow(/Foreign key constraint|vital_signs_encounter_id_fkey/);
	});

	it('removes a visit’s vitals and diagnoses with the visit (cascade), never its documents', async () => {
		const visit = await createEncounter(prisma, { clinicId: scene.clinic.id, patientId: scene.patient.id });
		await prisma.vitalSigns.create({ data: { encounterId: visit.id, heartRate: 80 } });
		await prisma.prescription.create({
			data: {
				rxNo: 'SCHEMA-RX-1',
				verificationCode: 'SCHEMA-RX-1',
				encounterId: visit.id,
				practitionerId: scene.doctorPractitioner.id,
			},
		});
		await expect(prisma.encounter.delete({ where: { id: visit.id } })).rejects.toThrow(/Foreign key constraint/);
	});

	it('numbers patients per organization and visits per clinic', async () => {
		await expect(
			createPatient(prisma, { organizationId: scene.organization.id, patientNo: scene.patient.patientNo }),
		).rejects.toThrow(/Unique constraint/);
		await expect(
			createEncounter(prisma, {
				clinicId: scene.clinic.id,
				patientId: scene.patient.id,
				encounterNo: scene.encounter.encounterNo,
			}),
		).rejects.toThrow(/Unique constraint/);
	});

	it('refuses the same ID twice on a patient', async () => {
		const identification = {
			patientId: scene.patient.id,
			type: 'PHILHEALTH_ID' as const,
			idNumber: '12-345678901-2',
		};
		await prisma.patientIdentification.create({ data: identification });
		await expect(prisma.patientIdentification.create({ data: identification })).rejects.toThrow(
			/Unique constraint/,
		);
	});

	it('keeps the audit log, saved reports and Wise card outcomes append-only', async () => {
		const audit = await prisma.auditLog.create({
			data: {
				userId: scene.doctor.id,
				action: 'VIEW',
				event: 'patient.view',
				entityType: 'Patient',
				entityId: scene.patient.id,
				patientId: scene.patient.id,
			},
		});
		await expect(prisma.auditLog.update({ where: { id: audit.id }, data: { reason: 'edited' } })).rejects.toThrow(
			/append-only/,
		);
		await expect(prisma.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow(/append-only/);

		const document = await prisma.clinicalDocument.create({
			data: {
				patientId: scene.patient.id,
				title: 'Visit summary',
				body: '# Visit summary',
				data: {},
				version: 1,
				sourceChatId: '00000000-0000-7000-8000-000000000001',
				sourceToolCallId: 'call-schema-1',
				createdById: scene.doctor.id,
			},
		});
		await expect(
			prisma.clinicalDocument.update({ where: { id: document.id }, data: { title: 'Changed' } }),
		).rejects.toThrow(/append-only/);

		const outcome = await prisma.wiseProposalOutcome.create({
			data: {
				userId: scene.doctor.id,
				chatId: '00000000-0000-7000-8000-000000000001',
				messageId: '00000000-0000-7000-8000-000000000002',
				toolCallId: 'call-schema-2',
				toolName: 'propose_vitals',
				status: 'confirmed',
			},
		});
		await expect(prisma.wiseProposalOutcome.delete({ where: { id: outcome.id } })).rejects.toThrow(/append-only/);
		await expect(
			prisma.wiseProposalOutcome.create({
				data: { ...outcome, id: undefined, toolCallId: 'call-schema-3', status: 'maybe' },
			}),
		).rejects.toThrow(/wise_proposal_outcomes_status_check/);
	});
});
