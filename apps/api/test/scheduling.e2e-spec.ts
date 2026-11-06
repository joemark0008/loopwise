import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { EncounterService } from '../src/clinical/encounters/encounter.service.js';
import { VitalSignsService } from '../src/clinical/encounters/vital-signs.service.js';
import { AppointmentService } from '../src/clinical/scheduling/appointments/appointment.service.js';
import { AppointmentSlotService } from '../src/clinical/scheduling/appointments/appointment-slot.service.js';
import { addDays, manilaAt, manilaDate } from '../src/clinical/scheduling/manila-time.js';
import { CheckInService } from '../src/clinical/scheduling/queue/check-in.service.js';
import { QueueService } from '../src/clinical/scheduling/queue/queue.service.js';
import { VisitFlowService } from '../src/clinical/scheduling/queue/visit-flow.service.js';
import {
	APPOINTMENT_NOTIFIER,
	type AppointmentNotifier,
} from '../src/clinical/scheduling/reminders/appointment-notifier.js';
import { AppointmentReminderService } from '../src/clinical/scheduling/reminders/appointment-reminder.service.js';
import { SchedulingModule } from '../src/clinical/scheduling/scheduling.module.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { ConfigModule } from '../src/config/config.module.js';
import type { Patient, Practitioner } from '../src/generated/prisma/client.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	addCareRelationship,
	type ClinicScene,
	createClinicScene,
	createPatient,
	createPractitioner,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

/** The guards module (pulled in through Wise tool settings) needs an `AuthService`; the services are called directly. */
@Global()
@Module({ providers: [{ provide: AuthService, useValue: {} }], exports: [AuthService] })
class StubAuthModule {}

@Module({ imports: [ConfigModule, PrismaModule, StubAuthModule, SchedulingModule] })
class SchedulingTestModule {}

/** Rejection → the mapped GraphQL error (`code`, `errorCode`, message). */
const failure = (promise: Promise<unknown>) =>
	promise.then(
		() => {
			throw new Error('expected a failure');
		},
		(error: unknown) => mapError(error),
	);

/**
 * Appointments and the queue against Postgres: booking into a doctor's slots (schedule, leave, max patients), check-in
 * opening the visit in one transaction, the priority lane, triage, the doctor's own line, the cashier, cancelling, the
 * board without names, and next-day reminders. Row-level security and the audit trail are real.
 */
describe('scheduling (e2e)', () => {
	let prisma: PrismaService;
	let appointments: AppointmentService;
	let slots: AppointmentSlotService;
	let checkIns: CheckInService;
	let queue: QueueService;
	let flow: VisitFlowService;
	let vitals: VitalSignsService;
	let encounters: EncounterService;
	let reminders: AppointmentReminderService;
	const notifier: AppointmentNotifier = { sendReminder: vi.fn(() => Promise.resolve(true)) };

	let scene: ClinicScene;
	let frontDesk: FixtureUser;
	let nurse: FixtureUser;
	let cashier: FixtureUser;
	let otherDoctorPractitioner: Practitioner;
	let patient: Patient;
	let senior: Patient;
	const today = manilaDate();
	const tomorrow = addDays(today, 1);

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [SchedulingTestModule] })
			.overrideProvider(APPOINTMENT_NOTIFIER)
			.useValue(notifier)
			.compile();
		const app = moduleRef.createNestApplication({ logger: ['error'] });
		await app.init();
		prisma = app.get(PrismaService);
		appointments = app.get(AppointmentService);
		slots = app.get(AppointmentSlotService);
		checkIns = app.get(CheckInService);
		queue = app.get(QueueService);
		flow = app.get(VisitFlowService);
		vitals = app.get(VitalSignsService, { strict: false });
		encounters = app.get(EncounterService, { strict: false });
		reminders = app.get(AppointmentReminderService);

		scene = await createClinicScene(prisma);
		frontDesk = await createUser(prisma, { firstName: 'Nina', lastName: 'Flores' });
		nurse = await createUser(prisma, { firstName: 'Joy', lastName: 'Santos' });
		cashier = await createUser(prisma, { firstName: 'Rosa', lastName: 'Dela Cruz' });
		await grantClinicRoles(prisma, scene.clinic.id, frontDesk.id, ['RECEPTIONIST']);
		await grantClinicRoles(prisma, scene.clinic.id, nurse.id, ['NURSE']);
		await grantClinicRoles(prisma, scene.clinic.id, cashier.id, ['CASHIER']);
		otherDoctorPractitioner = await createPractitioner(prisma, {
			userId: scene.otherDoctor.id,
			clinicIds: [scene.clinic.id],
		});
		// Every day 08:00–12:00 in 30-minute slots; the other doctor sees two patients a session.
		for (const [practitioner, maxPatients] of [
			[scene.doctorPractitioner, null],
			[otherDoctorPractitioner, 2],
		] as const) {
			await prisma.practitionerSchedule.createMany({
				data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
					practitionerId: practitioner.id,
					clinicId: scene.clinic.id,
					dayOfWeek,
					startTime: new Date('1970-01-01T08:00:00Z'),
					endTime: new Date('1970-01-01T12:00:00Z'),
					slotMinutes: 30,
					maxPatients,
				})),
			});
		}
		// Registered at the front desk (registration gives the desk a care relationship).
		patient = await createPatient(prisma, {
			organizationId: scene.organization.id,
			firstName: 'Liza',
			lastName: 'Mendoza',
			mobileNo: '+639000000003',
			careTeam: [frontDesk.id],
		});
		senior = await createPatient(prisma, {
			organizationId: scene.organization.id,
			firstName: 'Jose',
			lastName: 'Ramos',
			birthDate: new Date('1950-03-01T00:00:00Z'),
			careTeam: [frontDesk.id],
		});
	});

	afterAll(async () => {
		await prisma?.$disconnect();
	});

	const at = (date: string, time: string) => manilaAt(date, time).toISOString();

	describe('appointments', () => {
		it("lists the doctor's open slots and books one; the slot is then taken", async () => {
			const before = await slots.list(frontDesk.id, {
				clinicId: scene.clinic.id,
				practitionerId: scene.doctorPractitioner.id,
				date: tomorrow,
			});
			expect(before).toHaveLength(8);
			expect(before.every((slot) => slot.status === 'OPEN')).toBe(true);

			const booked = await appointments.book(frontDesk.id, {
				clinicId: scene.clinic.id,
				patientId: patient.id,
				practitionerId: scene.doctorPractitioner.id,
				scheduledStart: at(tomorrow, '09:00'),
				visitType: 'FOLLOW_UP',
				channel: 'FACEBOOK_MESSENGER',
				reason: 'BP follow-up',
			});
			expect(booked).toMatchObject({
				status: 'SCHEDULED',
				visitType: 'FOLLOW_UP',
				channel: 'FACEBOOK_MESSENGER',
				patient: { name: 'Liza Mendoza' },
			});
			expect(booked.scheduledEnd?.toISOString()).toBe(at(tomorrow, '09:30'));

			const after = await slots.list(frontDesk.id, {
				clinicId: scene.clinic.id,
				practitionerId: scene.doctorPractitioner.id,
				date: tomorrow,
			});
			expect(after.find((slot) => slot.start.toISOString() === at(tomorrow, '09:00'))?.status).toBe('BOOKED');

			const audit = await prisma.auditLog.findFirst({
				where: { event: 'appointment.book', entityId: booked.id },
			});
			expect(audit).toMatchObject({ userId: frontDesk.id, patientId: patient.id, action: 'CREATE' });
		});

		it('refuses a taken slot, a time outside the schedule, and a desk that does not book', async () => {
			const input = {
				clinicId: scene.clinic.id,
				patientId: senior.id,
				practitionerId: scene.doctorPractitioner.id,
				scheduledStart: at(tomorrow, '09:00'),
			};
			expect(await failure(appointments.book(frontDesk.id, input))).toMatchObject({
				errorCode: 'SLOT_UNAVAILABLE',
				details: { reason: 'BOOKED' },
			});
			expect(
				await failure(appointments.book(frontDesk.id, { ...input, scheduledStart: at(tomorrow, '13:00') })),
			).toMatchObject({ errorCode: 'SLOT_NOT_IN_SCHEDULE' });
			expect(
				await failure(appointments.book(nurse.id, { ...input, scheduledStart: at(tomorrow, '10:00') })),
			).toMatchObject({ errorCode: 'SCHEDULING_DESK_ACCESS' });
		});

		it("fills a session at the doctor's max patients, and closes the slots of a leave", async () => {
			const day = addDays(today, 3);
			for (const [who, time] of [
				[patient, '08:00'],
				[senior, '08:30'],
			] as const) {
				await appointments.book(frontDesk.id, {
					clinicId: scene.clinic.id,
					patientId: who.id,
					practitionerId: otherDoctorPractitioner.id,
					scheduledStart: at(day, time),
				});
			}
			const full = await slots.list(frontDesk.id, {
				clinicId: scene.clinic.id,
				practitionerId: otherDoctorPractitioner.id,
				date: day,
			});
			expect(full.map((slot) => slot.status)).toEqual([
				'BOOKED',
				'BOOKED',
				'FULL',
				'FULL',
				'FULL',
				'FULL',
				'FULL',
				'FULL',
			]);

			await prisma.practitionerLeave.create({
				data: {
					practitionerId: scene.doctorPractitioner.id,
					startAt: manilaAt(day, '10:00'),
					endAt: manilaAt(day, '12:00'),
					reason: 'Conference',
				},
			});
			const withLeave = await slots.list(frontDesk.id, {
				clinicId: scene.clinic.id,
				practitionerId: scene.doctorPractitioner.id,
				date: day,
			});
			expect(withLeave.filter((slot) => slot.status === 'ON_LEAVE')).toHaveLength(4);
			expect(
				await failure(
					appointments.book(frontDesk.id, {
						clinicId: scene.clinic.id,
						patientId: patient.id,
						practitionerId: scene.doctorPractitioner.id,
						scheduledStart: at(day, '10:30'),
					}),
				),
			).toMatchObject({ errorCode: 'SLOT_UNAVAILABLE', details: { reason: 'ON_LEAVE' } });
		});

		it('reschedules (the old booking kept as RESCHEDULED), cancels with a reason, and refuses an early no-show', async () => {
			const day = addDays(today, 2);
			const first = await appointments.book(frontDesk.id, {
				clinicId: scene.clinic.id,
				patientId: senior.id,
				practitionerId: scene.doctorPractitioner.id,
				scheduledStart: at(day, '08:00'),
			});
			const moved = await appointments.reschedule(frontDesk.id, {
				appointmentId: first.id,
				scheduledStart: at(day, '11:00'),
				reason: 'Patient asked',
			});
			expect(moved).toMatchObject({ status: 'SCHEDULED', rescheduledFrom: first.id });
			expect(moved.scheduledStart.toISOString()).toBe(at(day, '11:00'));
			expect(await prisma.appointment.findUnique({ where: { id: first.id } })).toMatchObject({
				status: 'RESCHEDULED',
			});

			expect(await failure(appointments.markNoShow(frontDesk.id, moved.id))).toMatchObject({
				errorCode: 'NO_SHOW_TOO_EARLY',
			});
			expect(
				await failure(appointments.cancel(frontDesk.id, { appointmentId: moved.id, reason: '  ' })),
			).toMatchObject({ errorCode: 'CANCEL_REASON_REQUIRED' });
			const cancelled = await appointments.cancel(frontDesk.id, {
				appointmentId: moved.id,
				reason: 'Feeling better',
			});
			expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelledReason: 'Feeling better' });
		});

		it("lists a clinic's day and week; a doctor sees only the patients in their care", async () => {
			const week = await appointments.list(frontDesk.id, { clinicId: scene.clinic.id, from: today, days: 7 });
			expect(week.length).toBeGreaterThanOrEqual(4);
			const day = await appointments.list(frontDesk.id, {
				clinicId: scene.clinic.id,
				from: tomorrow,
				practitionerId: scene.doctorPractitioner.id,
			});
			expect(day.map((appointment) => appointment.patient.name)).toEqual(['Liza Mendoza']);
			// Dr. Reyes has no care relationship with Liza yet: deny by default.
			expect(
				await appointments.list(scene.doctor.id, { clinicId: scene.clinic.id, from: tomorrow, days: 1 }),
			).toEqual([]);
		});
	});

	describe('queue', () => {
		let bookedTicketId: string;
		let encounterId: string;

		it("checks in today's booking: opens the visit, issues A-001 and marks the booking ARRIVED", async () => {
			const booking = await prisma.appointment.create({
				data: {
					clinicId: scene.clinic.id,
					patientId: patient.id,
					practitionerId: scene.doctorPractitioner.id,
					scheduledStart: new Date(),
					visitType: 'FOLLOW_UP',
					channel: 'PHONE',
					reason: 'BP follow-up',
				},
			});
			const ticket = await checkIns.checkIn(frontDesk.id, {
				clinicId: scene.clinic.id,
				appointmentId: booking.id,
			});
			bookedTicketId = ticket.id;
			encounterId = ticket.encounter!.id;
			expect(ticket).toMatchObject({
				code: 'A-001',
				status: 'WAITING',
				station: 'TRIAGE',
				stationLabel: 'Triage',
				isPriority: false,
				patient: { name: 'Liza Mendoza' },
				encounter: { status: 'OPEN', reason: 'BP follow-up' },
			});
			const encounter = await prisma.encounter.findUnique({ where: { id: encounterId } });
			expect(encounter).toMatchObject({
				appointmentId: booking.id,
				practitionerId: scene.doctorPractitioner.id,
				clinicId: scene.clinic.id,
				type: 'FOLLOW_UP',
				status: 'OPEN',
			});
			expect(encounter?.encounterNo).toMatch(new RegExp(`^${scene.clinic.code}-ENC-\\d{4}-\\d{6}$`));
			expect(await prisma.appointment.findUnique({ where: { id: booking.id } })).toMatchObject({
				status: 'ARRIVED',
			});
			// The booked doctor now has the patient in their care.
			expect(
				await prisma.careRelationship.count({ where: { userId: scene.doctor.id, patientId: patient.id } }),
			).toBe(1);
			expect(
				await failure(checkIns.checkIn(frontDesk.id, { clinicId: scene.clinic.id, appointmentId: booking.id })),
			).toMatchObject({ errorCode: 'ALREADY_CHECKED_IN' });
		});

		it('puts a senior walk-in in the priority lane, called before earlier regular patients', async () => {
			const walkIn = await checkIns.checkIn(frontDesk.id, {
				clinicId: scene.clinic.id,
				patientId: senior.id,
				practitionerId: scene.doctorPractitioner.id,
				reason: 'Cough for 3 days',
				priorityReason: 'SENIOR_CITIZEN',
			});
			expect(walkIn).toMatchObject({ code: 'P-001', isPriority: true, priorityReason: 'SENIOR_CITIZEN' });
			expect(walkIn.appointment).toMatchObject({ status: 'ARRIVED' });

			const called = await queue.callNext(nurse.id, { clinicId: scene.clinic.id, station: 'TRIAGE' });
			expect(called).toMatchObject({ code: 'P-001', status: 'CALLED' });
			// Not there: skipped, then back in line with the same number.
			await queue.skip(nurse.id, walkIn.id);
			expect(await queue.requeue(frontDesk.id, walkIn.id)).toMatchObject({ code: 'P-001', status: 'WAITING' });
		});

		it('takes the booked patient through triage to the doctor, who starts the visit', async () => {
			expect(await failure(flow.start(frontDesk.id, bookedTicketId))).toMatchObject({
				errorCode: 'SCHEDULING_DESK_ACCESS',
			});
			const serving = await flow.start(nurse.id, bookedTicketId);
			expect(serving).toMatchObject({ status: 'SERVING', station: 'TRIAGE' });
			await vitals.record(nurse.id, { encounterId, systolicMmHg: 150, diastolicMmHg: 95, heartRateBpm: 84 });

			const sent = await flow.send(nurse.id, { ticketId: bookedTicketId, station: 'DOCTOR' });
			expect(sent).toMatchObject({ status: 'WAITING', station: 'DOCTOR', code: 'A-001' });
			expect(sent.stationLabel).toContain('Dr.');

			const line = await queue.list(scene.doctor.id, { clinicId: scene.clinic.id, mine: true });
			expect(line.map((ticket) => [ticket.code, ticket.patient?.name])).toEqual([['A-001', 'Liza Mendoza']]);
			// No practitioner profile, no line of one's own.
			expect(await queue.list(nurse.id, { clinicId: scene.clinic.id, mine: true })).toEqual([]);
			expect(
				await failure(
					queue.callNext(scene.otherDoctor.id, {
						clinicId: scene.clinic.id,
						station: 'DOCTOR',
						practitionerId: scene.doctorPractitioner.id,
					}),
				),
			).toMatchObject({ errorCode: 'NOT_YOUR_QUEUE_LINE' });

			const called = await queue.callNext(scene.doctor.id, { clinicId: scene.clinic.id, station: 'DOCTOR' });
			expect(called).toMatchObject({ code: 'A-001', status: 'CALLED' });
			const started = await flow.start(scene.doctor.id, bookedTicketId);
			expect(started).toMatchObject({ status: 'SERVING', encounter: { status: 'IN_PROGRESS' } });
			expect(started.appointment).toMatchObject({ status: 'IN_PROGRESS' });
		});

		it('sends the patient to the cashier (the visit goes to billing) and closes the ticket there', async () => {
			const atCashier = await flow.send(scene.doctor.id, { ticketId: bookedTicketId, station: 'CASHIER' });
			expect(atCashier).toMatchObject({
				station: 'CASHIER',
				status: 'WAITING',
				encounter: { status: 'FOR_BILLING' },
				appointment: { status: 'COMPLETED' },
			});
			await flow.start(cashier.id, bookedTicketId);
			expect(await flow.complete(cashier.id, bookedTicketId)).toMatchObject({ status: 'DONE' });
			expect(await prisma.auditLog.count({ where: { entityId: bookedTicketId } })).toBeGreaterThanOrEqual(7);
		});

		it('cancels a patient who left before the doctor, with the visit and the booking', async () => {
			const ticket = (await queue.list(nurse.id, { clinicId: scene.clinic.id, station: 'TRIAGE' })).find(
				(candidate) => candidate.code === 'P-001',
			)!;
			const cancelled = await flow.cancel(frontDesk.id, { ticketId: ticket.id, reason: 'Left before triage' });
			expect(cancelled).toMatchObject({
				status: 'CANCELLED',
				encounter: { status: 'CANCELLED' },
				appointment: { status: 'CANCELLED' },
			});
		});

		it('numbers concurrent check-ins of one lane without gaps or repeats', async () => {
			const walkIns = await Promise.all(
				Array.from({ length: 5 }, async (_, index) => {
					const someone = await createPatient(prisma, {
						organizationId: scene.organization.id,
						firstName: `Walk${index}`,
						lastName: 'In',
					});
					await addCareRelationship(prisma, {
						patientId: someone.id,
						userId: frontDesk.id,
						organizationId: scene.organization.id,
					});
					return someone;
				}),
			);
			const tickets = await Promise.all(
				walkIns.map((someone) =>
					checkIns.checkIn(frontDesk.id, {
						clinicId: scene.clinic.id,
						patientId: someone.id,
						practitionerId: otherDoctorPractitioner.id,
					}),
				),
			);
			expect(tickets.map((ticket) => ticket.number).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6]);
		});

		it('shows the board numbers and stations, never a name', async () => {
			const board = await queue.board(nurse.id, scene.clinic.id);
			expect(board.waiting.length).toBeGreaterThanOrEqual(5);
			expect(JSON.stringify(board)).not.toMatch(/Mendoza|Ramos|Walk/);
			expect(board.waiting[0]).toMatchObject({ code: 'A-002', station: 'TRIAGE', stationLabel: 'Triage' });
		});
	});

	describe('the ticket follows the visit moved from the encounter page', () => {
		/** A walk-in with the doctor, checked in at the front desk: the visit OPEN, the ticket waiting at triage. */
		async function walkIn(firstName: string) {
			const someone = await createPatient(prisma, {
				organizationId: scene.organization.id,
				firstName,
				lastName: 'Follows',
				careTeam: [frontDesk.id],
			});
			const ticket = await checkIns.checkIn(frontDesk.id, {
				clinicId: scene.clinic.id,
				patientId: someone.id,
				practitionerId: scene.doctorPractitioner.id,
				reason: 'Cough',
			});
			return { ticketId: ticket.id, encounterId: ticket.encounter!.id, appointmentId: ticket.appointment!.id };
		}
		const ticketOf = (id: string) => prisma.queueTicket.findUniqueOrThrow({ where: { id } });
		const bookingOf = (id: string) => prisma.appointment.findUniqueOrThrow({ where: { id } });

		it('starts, bills, reopens and completes the visit from the chart; the ticket and the booking follow', async () => {
			const visit = await walkIn('Start');

			await encounters.transition(scene.doctor.id, { encounterId: visit.encounterId, status: 'IN_PROGRESS' });
			expect(await ticketOf(visit.ticketId)).toMatchObject({
				station: 'DOCTOR',
				status: 'SERVING',
				practitionerId: scene.doctorPractitioner.id,
			});
			expect(await bookingOf(visit.appointmentId)).toMatchObject({ status: 'IN_PROGRESS' });

			await encounters.transition(scene.doctor.id, { encounterId: visit.encounterId, status: 'FOR_BILLING' });
			expect(await ticketOf(visit.ticketId)).toMatchObject({ station: 'CASHIER', status: 'WAITING' });
			expect(await bookingOf(visit.appointmentId)).toMatchObject({ status: 'COMPLETED' });

			// Reopened before payment: back with the doctor (the booking stays COMPLETED, its end state).
			await encounters.transition(scene.doctor.id, { encounterId: visit.encounterId, status: 'IN_PROGRESS' });
			expect(await ticketOf(visit.ticketId)).toMatchObject({ station: 'DOCTOR', status: 'SERVING' });

			await encounters.transition(scene.doctor.id, { encounterId: visit.encounterId, status: 'COMPLETED' });
			expect(await ticketOf(visit.ticketId)).toMatchObject({ status: 'DONE' });

			const followed = await prisma.auditLog.findMany({
				where: { entityId: visit.ticketId, event: { startsWith: 'queue.follow_visit_' } },
				orderBy: { createdAt: 'asc' },
			});
			expect(followed.map((row) => [row.event, row.userId])).toEqual([
				['queue.follow_visit_in_progress', scene.doctor.id],
				['queue.follow_visit_for_billing', scene.doctor.id],
				['queue.follow_visit_in_progress', scene.doctor.id],
				['queue.follow_visit_completed', scene.doctor.id],
			]);
		});

		it('cancels the ticket and the booking with a visit cancelled from the chart', async () => {
			const visit = await walkIn('Cancel');
			await encounters.transition(frontDesk.id, {
				encounterId: visit.encounterId,
				status: 'CANCELLED',
				reason: 'Registered twice',
			});
			expect(await ticketOf(visit.ticketId)).toMatchObject({ status: 'CANCELLED' });
			expect(await bookingOf(visit.appointmentId)).toMatchObject({
				status: 'CANCELLED',
				cancelledReason: 'Registered twice',
			});
		});

		it('leaves the moves made from the queue pages to the queue (no second move of the ticket)', async () => {
			const visit = await walkIn('Queue');
			// From the queue page: the visit moves with the queue's own audit rows, none from the listener.
			await flow.start(nurse.id, visit.ticketId);
			await flow.send(nurse.id, { ticketId: visit.ticketId, station: 'DOCTOR' });
			const started = await flow.start(scene.doctor.id, visit.ticketId);
			expect(started).toMatchObject({ status: 'SERVING', encounter: { status: 'IN_PROGRESS' } });
			expect(
				await prisma.auditLog.count({
					where: { entityId: visit.ticketId, event: { startsWith: 'queue.follow_visit_' } },
				}),
			).toBe(0);
			expect(
				await prisma.auditLog.count({ where: { entityId: visit.encounterId, event: 'encounter.in_progress' } }),
			).toBe(1);
		});
	});

	describe('reminders', () => {
		it("reminds tomorrow's patients once, with a number to send to", async () => {
			vi.mocked(notifier.sendReminder).mockClear();
			const sent = await reminders.sendDue();
			expect(sent).toBe(1);
			expect(notifier.sendReminder).toHaveBeenCalledWith(
				expect.objectContaining({ to: '+639000000003', date: tomorrow, time: '09:00' }),
			);
			const booked = await prisma.appointment.findFirst({
				where: { patientId: patient.id, reminderSentAt: { not: null } },
			});
			expect(booked).not.toBeNull();
			expect(await prisma.auditLog.count({ where: { event: 'appointment.remind', userId: null } })).toBe(1);
			expect(await reminders.sendDue()).toBe(0);
		});
	});
});
