import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClinicalDbModule } from '../src/clinical/rls/clinical-db.module.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { ConfigModule } from '../src/config/config.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	addCareRelationship,
	type ClinicScene,
	createClinic,
	createClinicScene,
	createEncounter,
	createPatient,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

@Module({ imports: [ConfigModule, PrismaModule, ClinicalDbModule] })
class RlsTestModule {}

/**
 * Row-level security on the clinical tables (DESIGN.md §8, migration 0001_rls_and_triggers), through
 * `ClinicalDbService.asUser`. The setup runs as the owner, as system work does.
 */
describe('clinical row-level security (e2e)', () => {
	let moduleRef: TestingModule;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	let scene: ClinicScene;
	let jose: { id: string };
	let annexPatient: { id: string };
	const staff = {} as Record<'breakGlass' | 'frontDesk' | 'annexFrontDesk' | 'medtech', FixtureUser>;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		moduleRef = await Test.createTestingModule({ imports: [RlsTestModule] }).compile();
		await moduleRef.init();
		prisma = moduleRef.get(PrismaService);
		db = moduleRef.get(ClinicalDbService);

		scene = await createClinicScene(prisma);
		const { organization, clinic, doctor } = scene;
		jose = await createPatient(prisma, {
			organizationId: organization.id,
			firstName: 'Jose',
			careTeam: [doctor.id],
		});

		// A second branch of the organization, with its own front desk and a patient seen only there.
		const annex = await createClinic(prisma, { organizationId: organization.id, name: 'Annex' });
		annexPatient = await createPatient(prisma, { organizationId: organization.id, firstName: 'Pedro' });
		await createEncounter(prisma, { clinicId: annex.id, patientId: annexPatient.id });

		for (const key of ['breakGlass', 'frontDesk', 'annexFrontDesk', 'medtech'] as const) {
			staff[key] = await createUser(prisma);
		}
		await grantClinicRoles(prisma, clinic.id, staff.breakGlass.id, ['DOCTOR']);
		await addCareRelationship(prisma, {
			patientId: scene.patient.id,
			userId: staff.breakGlass.id,
			organizationId: organization.id,
			reason: 'BREAK_GLASS',
			note: 'Emergency',
			expiresAt: new Date(Date.now() - 60_000),
		});
		await grantClinicRoles(prisma, clinic.id, staff.frontDesk.id, ['RECEPTIONIST']);
		await grantClinicRoles(prisma, annex.id, staff.annexFrontDesk.id, ['RECEPTIONIST']);
		await grantClinicRoles(prisma, clinic.id, staff.medtech.id, ['MEDTECH']);

		// Jose has a visit with a lab order at the main clinic; Maria's visit has none.
		const joseVisit = await createEncounter(prisma, { clinicId: clinic.id, patientId: jose.id });
		await prisma.diagnosticOrder.create({ data: { orderNo: `LAB-${joseVisit.id}`, encounterId: joseVisit.id } });
	});

	afterAll(async () => {
		await moduleRef?.close();
	});

	const patientsOf = (userId: string) =>
		db
			.asUser(userId, (tx) => tx.patient.findMany({ select: { id: true } }))
			.then((rows) => rows.map((r) => r.id).sort());

	it('shows a doctor the patients they have a care relationship with', async () => {
		expect(await patientsOf(scene.doctor.id)).toEqual([scene.patient.id, jose.id].sort());
	});

	it('hides the patient from a doctor whose break-glass access has expired', async () => {
		expect(await patientsOf(staff.breakGlass.id)).toEqual([]);
		expect(await patientsOf(scene.otherDoctor.id)).toEqual([]);
	});

	it('shows the front desk the patients with a visit at their clinic only', async () => {
		expect(await patientsOf(staff.frontDesk.id)).toEqual([scene.patient.id, jose.id].sort());
		expect(await patientsOf(staff.annexFrontDesk.id)).toEqual([annexPatient.id]);
	});

	it('shows the lab the patients with a diagnostic order at their clinic, and those orders', async () => {
		expect(await patientsOf(staff.medtech.id)).toEqual([jose.id]);
		const orders = await db.asUser(staff.medtech.id, (tx) => tx.diagnosticOrder.findMany());
		expect(orders).toHaveLength(1);
	});

	it('refuses to delete clinical data as a user', async () => {
		const error = await db
			.asUser(scene.doctor.id, (tx) => tx.patient.delete({ where: { id: scene.patient.id } }))
			.catch((e: unknown) => e);
		expect(String(error)).toMatch(/permission denied/);
		expect(await prisma.patient.count({ where: { id: scene.patient.id } })).toBe(1);
	});

	it('refuses to write a record for a patient the user cannot see', async () => {
		const error = await db
			.asUser(scene.otherDoctor.id, (tx) =>
				tx.patientAllergy.create({
					data: { patientId: scene.patient.id, type: 'DRUG', allergen: 'Penicillin' },
				}),
			)
			.catch((e: unknown) => e);
		expect(mapError(error)).toMatchObject({ code: 'FORBIDDEN', errorCode: 'ROW_SECURITY_DENIED' });
	});

	it('refuses an encounter at a clinic the user does not work at', async () => {
		const error = await db
			.asUser(scene.doctor.id, async (tx) => {
				const annex = await tx.clinic.findFirstOrThrow({ where: { name: 'Annex' } });
				return tx.encounter.create({
					data: { clinicId: annex.id, patientId: scene.patient.id, encounterNo: 'X-1' },
				});
			})
			.catch((e: unknown) => e);
		expect(mapError(error)).toMatchObject({ code: 'FORBIDDEN' });
	});

	it('lets system work see every patient', async () => {
		const patients = await db.asSystem((tx) => tx.patient.findMany({ select: { id: true } }));
		expect(patients.map((patient) => patient.id).sort()).toEqual(
			[scene.patient.id, jose.id, annexPatient.id].sort(),
		);
	});
});
