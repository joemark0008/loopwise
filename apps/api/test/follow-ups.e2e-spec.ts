import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { FollowUpService } from '../src/clinical/follow-ups/follow-up.service.js';
import { FollowUpWiseReader } from '../src/clinical/follow-ups/follow-up-wise-reader.js';
import { FollowUpsModule } from '../src/clinical/follow-ups/follow-ups.module.js';
import { AppointmentService } from '../src/clinical/scheduling/appointments/appointment.service.js';
import { addDays, dateColumn, manilaAt, manilaDate } from '../src/clinical/scheduling/manila-time.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { ConfigModule } from '../src/config/config.module.js';
import type { Disposition, EncounterStatus, Patient, Practitioner } from '../src/generated/prisma/client.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	type ClinicScene,
	createClinicScene,
	createEncounter,
	createPatient,
	createPractitioner,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

@Global()
@Module({ providers: [{ provide: AuthService, useValue: {} }], exports: [AuthService] })
class StubAuthModule {}

@Module({ imports: [ConfigModule, PrismaModule, StubAuthModule, FollowUpsModule] })
class FollowUpsTestModule {}

const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error('expected a failure');
		},
		(error: unknown) => mapError(error),
	);

/**
 * The follow-up list against Postgres: visits whose follow-up date is overdue, due or coming up, until a later visit or
 * standing booking with the same doctor; a doctor's own, the front desk's clinic list and the admin's; booking one
 * through Scheduling's `bookAppointment` takes it off the list. Row-level security and the audit trail are real.
 */
describe('follow-ups (e2e)', () => {
	let prisma: PrismaService;
	let followUps: FollowUpService;
	let reader: FollowUpWiseReader;
	let appointments: AppointmentService;
	let scene: ClinicScene;
	let frontDesk: FixtureUser;
	let nurse: FixtureUser;
	let internist: Practitioner;
	const today = manilaDate();
	const patients: Record<string, Patient> = {};

	/** A past visit with its follow-up date `inDays` from today (negative: overdue). */
	async function visit(
		key: string,
		opts: {
			practitioner: Practitioner;
			daysAgo: number;
			inDays: number;
			disposition?: Disposition;
			status?: EncounterStatus;
			careTeam: string[];
		},
	) {
		patients[key] ??= await createPatient(prisma, {
			organizationId: scene.organization.id,
			firstName: key,
			lastName: 'Followup',
			careTeam: opts.careTeam,
		});
		const encounter = await createEncounter(prisma, {
			clinicId: scene.clinic.id,
			patientId: patients[key].id,
			practitionerId: opts.practitioner.id,
			status: opts.status ?? 'COMPLETED',
			startedAt: new Date(Date.now() - opts.daysAgo * 86_400_000),
			chiefComplaint: `${key} visit`,
		});
		await prisma.encounter.update({
			where: { id: encounter.id },
			data: {
				followUpDate: dateColumn(addDays(today, opts.inDays)),
				disposition: opts.disposition ?? 'FOR_FOLLOW_UP',
			},
		});
		return encounter;
	}
	const names = (rows: { patientName: string }[]) => rows.map((row) => row.patientName.split(' ')[0]).sort();

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [FollowUpsTestModule] }).compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		prisma = app.get(PrismaService);
		followUps = app.get(FollowUpService);
		reader = app.get(FollowUpWiseReader);
		appointments = app.get(AppointmentService, { strict: false });

		scene = await createClinicScene(prisma);
		frontDesk = await createUser(prisma, { firstName: 'Nina', lastName: 'Flores' });
		nurse = await createUser(prisma, { firstName: 'Joy', lastName: 'Santos' });
		await grantClinicRoles(prisma, scene.clinic.id, frontDesk.id, ['RECEPTIONIST']);
		await grantClinicRoles(prisma, scene.clinic.id, nurse.id, ['NURSE']);
		internist = await createPractitioner(prisma, { userId: scene.otherDoctor.id, clinicIds: [scene.clinic.id] });
		await prisma.practitionerSchedule.createMany({
			data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
				practitionerId: scene.doctorPractitioner.id,
				clinicId: scene.clinic.id,
				dayOfWeek,
				startTime: new Date('1970-01-01T08:00:00Z'),
				endTime: new Date('1970-01-01T12:00:00Z'),
				slotMinutes: 30,
			})),
		});

		const doctor = scene.doctorPractitioner;
		const reyesTeam = [scene.doctor.id];
		await visit('Overdue', { practitioner: doctor, daysAgo: 20, inDays: -5, careTeam: reyesTeam });
		await visit('Due', {
			practitioner: doctor,
			daysAgo: 14,
			inDays: 0,
			disposition: 'REFERRED',
			careTeam: reyesTeam,
		});
		await visit('Upcoming', { practitioner: internist, daysAgo: 4, inDays: 3, careTeam: [scene.otherDoctor.id] });
		// Seen again by the same doctor since: done.
		await visit('Seen', { practitioner: doctor, daysAgo: 30, inDays: -16, careTeam: reyesTeam });
		await createEncounter(prisma, {
			clinicId: scene.clinic.id,
			patientId: patients.Seen.id,
			practitionerId: doctor.id,
			status: 'COMPLETED',
			startedAt: new Date(Date.now() - 10 * 86_400_000),
		});
		// A cancelled visit sets no follow-up.
		await visit('Cancelled', {
			practitioner: doctor,
			daysAgo: 9,
			inDays: -2,
			status: 'CANCELLED',
			careTeam: reyesTeam,
		});
		// Booked with another doctor only: still due with this one.
		await visit('Other', { practitioner: doctor, daysAgo: 12, inDays: -1, careTeam: reyesTeam });
		await prisma.appointment.create({
			data: {
				clinicId: scene.clinic.id,
				patientId: patients.Other.id,
				practitionerId: internist.id,
				scheduledStart: manilaAt(addDays(today, 2), '09:00'),
				scheduledEnd: manilaAt(addDays(today, 2), '09:30'),
				visitType: 'FOLLOW_UP',
				channel: 'PHONE',
			},
		});
	});

	afterAll(async () => {
		await prisma?.$disconnect();
	});

	it("lists a doctor's own follow-ups, overdue first, with the disposition and timing", async () => {
		const mine = await followUps.list(scene.doctor.id, { clinicId: scene.clinic.id });
		expect(mine.map((row) => [row.patientName.split(' ')[0], row.timing, row.daysFromToday])).toEqual([
			['Overdue', 'OVERDUE', -5],
			['Other', 'OVERDUE', -1],
			['Due', 'DUE', 0],
		]);
		expect(mine.find((row) => row.timing === 'DUE')).toMatchObject({
			disposition: 'REFERRED',
			practitionerId: scene.doctorPractitioner.id,
			followUpDate: today,
		});
		// A doctor asking for a colleague's list still gets their own.
		expect(
			names(await followUps.list(scene.doctor.id, { clinicId: scene.clinic.id, practitionerId: internist.id })),
		).toEqual(['Due', 'Other', 'Overdue']);
		expect(names(await followUps.list(scene.otherDoctor.id, { clinicId: scene.clinic.id }))).toEqual(['Upcoming']);
		expect(
			await prisma.auditLog.count({
				where: { userId: scene.doctor.id, event: 'follow_up.list', action: 'VIEW' },
			}),
		).toBe(2);
	});

	it("gives the front desk and the admin the clinic's list, filtered by doctor and window; nurses none", async () => {
		expect(names(await followUps.list(frontDesk.id, { clinicId: scene.clinic.id }))).toEqual([
			'Due',
			'Other',
			'Overdue',
			'Upcoming',
		]);
		expect(names(await followUps.list(frontDesk.id, { clinicId: scene.clinic.id, withinDays: 2 }))).toEqual([
			'Due',
			'Other',
			'Overdue',
		]);
		expect(
			names(await followUps.list(frontDesk.id, { clinicId: scene.clinic.id, practitionerId: internist.id })),
		).toEqual(['Upcoming']);
		// The admin holds no care relationship to these patients: read as system after the admin check.
		expect(names(await followUps.list(scene.admin.id, { clinicId: scene.clinic.id }))).toHaveLength(4);
		expect(await failure(followUps.list(nurse.id, { clinicId: scene.clinic.id }))).toMatchObject({
			errorCode: 'FOLLOW_UPS_ACCESS',
		});
	});

	it('takes a follow-up off the list once the front desk books it with the doctor', async () => {
		const due = (await followUps.list(frontDesk.id, { clinicId: scene.clinic.id })).find((row) =>
			row.patientName.startsWith('Due'),
		)!;
		// "Book follow-up": the patient, the doctor and the suggested day, through Scheduling's booking.
		await appointments.book(frontDesk.id, {
			clinicId: scene.clinic.id,
			patientId: due.patientId,
			practitionerId: due.practitionerId!,
			scheduledStart: manilaAt(addDays(today, 1), '09:00').toISOString(),
			visitType: 'FOLLOW_UP',
			reason: 'Follow-up',
		});
		expect(names(await followUps.list(frontDesk.id, { clinicId: scene.clinic.id }))).toEqual([
			'Other',
			'Overdue',
			'Upcoming',
		]);
	});

	it("answers Wise's list_follow_ups for the doctor and for one patient's chart chat", async () => {
		const forDoctor = await reader.followUpsForWise(scene.doctor.id, scene.clinic.id, { limit: 60 });
		expect(forDoctor.followUps.map((row) => row.patient.name.split(' ')[0])).toEqual(['Overdue', 'Other']);
		const chart = await reader.followUpsForWise(frontDesk.id, scene.clinic.id, {
			patientId: patients.Upcoming.id,
			limit: 60,
		});
		expect(chart.followUps).toEqual([
			expect.objectContaining({ timing: 'UPCOMING', doctor: { id: internist.id, name: expect.any(String) } }),
		]);
		expect(
			await reader.followUpsForWise(frontDesk.id, scene.clinic.id, { doctor: 'Nobody', limit: 60 }).catch(String),
		).toMatch(/No doctor at this clinic matches/);
	});
});
