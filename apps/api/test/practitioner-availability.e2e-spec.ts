import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PractitionerScheduleService } from '../src/clinical/practitioners/schedules/practitioner-schedule.service.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicalTestApp, graphql, resetDatabase, signIn, useTestDatabase } from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createOrganization,
	createUser,
	type FixtureUser,
} from './fixtures/clinic-fixtures.js';

const time = (value: string) => new Date(`1970-01-01T${value}:00Z`);

/**
 * `PractitionerScheduleService` (read-only, for booking): a practitioner's sessions and slots on a date at a clinic,
 * minus their leaves, read as the user under row-level security.
 */
describe('practitioner availability (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	let schedules: PractitionerScheduleService;
	let scene: ClinicScene;
	let outsider: FixtureUser;

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		await resetDatabase(databaseUrl);
		app = await createClinicalTestApp();
		prisma = app.get(PrismaService);
		db = app.get(ClinicalDbService);
		schedules = app.get(PractitionerScheduleService);
		scene = await createClinicScene(prisma);

		// Tuesdays 09:00–10:00 (15-minute slots) and Wednesdays at the clinic.
		await prisma.practitionerSchedule.createMany({
			data: [
				{ dayOfWeek: 2, startTime: time('09:00'), endTime: time('10:00'), slotMinutes: 15, maxPatients: 4 },
				{ dayOfWeek: 3, startTime: time('13:00'), endTime: time('15:00'), slotMinutes: 30 },
			].map((row) => ({ ...row, practitionerId: scene.doctorPractitioner.id, clinicId: scene.clinic.id })),
		});
		// Out from Tuesday 2026-11-10 09:30 (Philippine time) to the end of the day.
		await prisma.practitionerLeave.create({
			data: {
				practitionerId: scene.doctorPractitioner.id,
				startAt: new Date('2026-11-10T09:30:00+08:00'),
				endAt: new Date('2026-11-11T00:00:00+08:00'),
				reason: 'Conference',
			},
		});

		outsider = await createUser(prisma);
		const otherOrg = await createOrganization(prisma);
		await createClinic(prisma, {
			organizationId: otherOrg.id,
			staff: [{ userId: outsider.id, roles: ['RECEPTIONIST'] }],
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	it('cuts the day into slots and drops those on leave', async () => {
		const day = await db.asUser(scene.otherDoctor.id, (tx) =>
			schedules.availabilityFor(tx, scene.doctorPractitioner.id, scene.clinic.id, '2026-11-10'),
		);
		expect(day.practicesHere).toBe(true);
		expect(day.dayOfWeek).toBe(2);
		expect(day.onLeave).toBe(true);
		expect(day.leaves).toHaveLength(1);
		expect(day.sessions).toHaveLength(1);
		expect(day.sessions[0]).toMatchObject({ startTime: '09:00', endTime: '10:00', maxPatients: 4, onLeave: true });
		expect(day.sessions[0].slots.map((slot) => slot.startsAt.toISOString())).toEqual([
			'2026-11-10T01:00:00.000Z',
			'2026-11-10T01:15:00.000Z',
		]);

		const nextWeek = await db.asUser(scene.otherDoctor.id, (tx) =>
			schedules.availabilityFor(tx, scene.doctorPractitioner.id, scene.clinic.id, '2026-11-17'),
		);
		expect(nextWeek.onLeave).toBe(false);
		expect(nextWeek.sessions[0].slots).toHaveLength(4);
	});

	it('answers whether the practitioner is on leave', async () => {
		const at = (iso: string) => new Date(iso);
		await db.asUser(scene.doctor.id, async (tx) => {
			expect(await schedules.isOnLeave(tx, scene.doctorPractitioner.id, at('2026-11-10T09:30:00+08:00'))).toBe(
				true,
			);
			expect(await schedules.isOnLeave(tx, scene.doctorPractitioner.id, at('2026-11-10T09:29:00+08:00'))).toBe(
				false,
			);
			expect(
				await schedules.isOnLeave(
					tx,
					scene.doctorPractitioner.id,
					at('2026-11-10T09:15:00+08:00'),
					at('2026-11-10T09:45:00+08:00'),
				),
			).toBe(true);
		});
	});

	it('has no sessions where the practitioner does not hold clinic', async () => {
		const day = await db.asUser(scene.admin.id, (tx) =>
			schedules.availabilityFor(tx, scene.adminPractitioner.id, scene.clinic.id, '2026-11-10'),
		);
		expect(day.sessions).toEqual([]);

		await prisma.practitionerClinic.update({
			where: {
				practitionerId_clinicId: { practitionerId: scene.doctorPractitioner.id, clinicId: scene.clinic.id },
			},
			data: { isActive: false },
		});
		try {
			const inactive = await db.asUser(scene.admin.id, (tx) =>
				schedules.availabilityFor(tx, scene.doctorPractitioner.id, scene.clinic.id, '2026-11-17'),
			);
			expect(inactive.practicesHere).toBe(false);
			expect(inactive.sessions).toEqual([]);
		} finally {
			await prisma.practitionerClinic.update({
				where: {
					practitionerId_clinicId: { practitionerId: scene.doctorPractitioner.id, clinicId: scene.clinic.id },
				},
				data: { isActive: true },
			});
		}
	});

	it('serves the selected clinic over GraphQL, and only to its staff', async () => {
		const query = `query ($id: ID!, $date: String!) {
			practitionerAvailability(practitionerId: $id, date: $date) {
				practicesHere onLeave sessions { startTime slots { startsAt } }
			}
		}`;
		const staff = await signIn(app, scene.doctor);
		const res = await graphql(app, staff, query, { id: scene.doctorPractitioner.id, date: '2026-11-17' }).set(
			'x-loopwise-clinic-id',
			scene.clinic.id,
		);
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.practitionerAvailability.sessions[0].slots).toHaveLength(4);

		// Another organization's front desk works on its own clinic: the schedule rows of this one stay hidden.
		const other = await signIn(app, outsider);
		const hidden = await graphql(app, other, query, { id: scene.doctorPractitioner.id, date: '2026-11-17' }).set(
			'x-loopwise-clinic-id',
			scene.clinic.id,
		);
		expect(hidden.body.data?.practitionerAvailability.sessions ?? []).toEqual([]);

		const badDate = await graphql(app, staff, query, { id: scene.doctorPractitioner.id, date: '17/11/2026' }).set(
			'x-loopwise-clinic-id',
			scene.clinic.id,
		);
		expect(badDate.body.errors[0].extensions.errorCode).toBe('INVALID_SCHEDULE');
	});
});
