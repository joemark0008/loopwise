import { addDays, dateColumn, manilaAt, manilaDate } from '../src/clinical/scheduling/manila-time.js';
import type { AppointmentStatus, BookingChannel, Prisma, VisitType } from '../src/generated/prisma/client.js';
import type { DemoContext, DemoPatientKey } from './seed-clinical.js';

/**
 * The demo's appointments and queue (synthetic): clinic hours for the doctors at TAG (unless clinic setup seeded them
 * already), a few bookings today and tomorrow, and today's queue: Ramon (OPEN visit) and Liza (booked, checked in)
 * waiting at triage, and Jose, a senior citizen in the priority lane, with Dr. Reyes. Times are Asia/Manila.
 */

const MINUTE = 60_000;

/** Weekly hours: [days, start, end, slot minutes, max patients]. */
const HOURS = {
	// Dr. Reyes holds clinic every day so the demo and the e2e specs always have slots.
	doctor: [
		[[0, 1, 2, 3, 4, 5, 6], '08:00', '12:00', 15, 16],
		[[0, 1, 2, 3, 4, 5, 6], '13:00', '17:00', 15, null],
	],
	internist: [[[1, 3, 5], '09:00', '12:00', 30, 6]],
	// The admin doctor's extended hours: an open slot for a same-day booking at almost any time.
	admin: [[[0, 1, 2, 3, 4, 5, 6], '06:00', '23:30', 15, null]],
} as const satisfies Record<
	'doctor' | 'internist' | 'admin',
	readonly (readonly [readonly number[], string, string, number, number | null])[]
>;

interface BookingSpec {
	patient: DemoPatientKey;
	day: 0 | 1;
	time: string;
	visitType: VisitType;
	channel: BookingChannel;
	status: AppointmentStatus;
	reason: string;
}

/** Upcoming bookings with Dr. Reyes. */
const BOOKINGS: readonly BookingSpec[] = [
	{
		patient: 'pedro',
		day: 0,
		time: '14:00',
		visitType: 'FOLLOW_UP',
		channel: 'SMS',
		status: 'SCHEDULED',
		reason: 'Follow-up of FBS',
	},
	{
		patient: 'carmen',
		day: 0,
		time: '15:30',
		visitType: 'FOLLOW_UP',
		channel: 'PHONE',
		status: 'CONFIRMED',
		reason: 'HbA1c result',
	},
	{
		patient: 'maria',
		day: 1,
		time: '09:00',
		visitType: 'FOLLOW_UP',
		channel: 'FACEBOOK_MESSENGER',
		status: 'CONFIRMED',
		reason: 'BP follow-up',
	},
	{
		patient: 'ana',
		day: 1,
		time: '10:00',
		visitType: 'NEW_PATIENT',
		channel: 'VIBER',
		status: 'SCHEDULED',
		reason: 'Dizziness',
	},
];

export async function seedScheduling(tx: Prisma.TransactionClient, demo: DemoContext): Promise<void> {
	const clinicId = demo.clinic.id;
	const today = manilaDate();
	const now = new Date();

	for (const [key, sessions] of Object.entries(HOURS) as [keyof typeof HOURS, (typeof HOURS)[keyof typeof HOURS]][]) {
		const practitionerId = demo.practitioners[key];
		if (await tx.practitionerSchedule.count({ where: { practitionerId, clinicId } })) {
			continue;
		}
		await tx.practitionerSchedule.createMany({
			data: sessions.flatMap(([days, start, end, slotMinutes, maxPatients]) =>
				days.map((dayOfWeek) => ({
					practitionerId,
					clinicId,
					dayOfWeek,
					startTime: new Date(`1970-01-01T${start}:00Z`),
					endTime: new Date(`1970-01-01T${end}:00Z`),
					slotMinutes,
					maxPatients,
				})),
			),
		});
	}

	const doctor = demo.practitioners.doctor;
	const book = (spec: Omit<BookingSpec, 'day' | 'time'> & { start: Date; minutes?: number }) =>
		tx.appointment.create({
			data: {
				clinicId,
				patientId: demo.patients[spec.patient],
				practitionerId: doctor,
				scheduledStart: spec.start,
				scheduledEnd: new Date(spec.start.getTime() + (spec.minutes ?? 15) * MINUTE),
				visitType: spec.visitType,
				channel: spec.channel,
				status: spec.status,
				reason: spec.reason,
				createdById: demo.staff.frontDesk,
			},
		});

	for (const spec of BOOKINGS) {
		await book({ ...spec, start: manilaAt(addDays(today, spec.day), spec.time) });
	}

	const queueDate = dateColumn(today);
	const ticket = (data: Omit<Prisma.QueueTicketUncheckedCreateInput, 'clinicId' | 'queueDate'>) =>
		tx.queueTicket.create({ data: { clinicId, queueDate, practitionerId: doctor, ...data } });

	// Ramon walked in for a BP check (his OPEN visit of today): A-001, waiting at triage.
	const ramon = demo.encounters.ramonToday;
	const ramonBooking = await book({
		patient: 'ramon',
		start: ramon.startedAt,
		visitType: 'FOLLOW_UP',
		channel: 'WALK_IN',
		status: 'ARRIVED',
		reason: 'BP check, ran out of maintenance medicines',
	});
	await tx.encounter.update({ where: { id: ramon.id }, data: { appointmentId: ramonBooking.id } });
	await ticket({ prefix: 'A', number: 1, encounterId: ramon.id, station: 'TRIAGE', issuedAt: ramon.startedAt });

	// Liza booked by Messenger and checked in ten minutes ago: A-002, waiting at triage.
	const checkedInAt = new Date(now.getTime() - 10 * MINUTE);
	const lizaBooking = await book({
		patient: 'liza',
		start: checkedInAt,
		visitType: 'NEW_PATIENT',
		channel: 'FACEBOOK_MESSENGER',
		status: 'ARRIVED',
		reason: 'Headache for two days',
	});
	const liza = await tx.encounter.create({
		data: {
			encounterNo: await demo.nextNumber('ENCOUNTER', checkedInAt),
			clinicId,
			patientId: demo.patients.liza,
			practitionerId: doctor,
			appointmentId: lizaBooking.id,
			type: 'CONSULTATION',
			status: 'OPEN',
			startedAt: checkedInAt,
			chiefComplaint: 'Headache for two days',
			createdById: demo.staff.frontDesk,
		},
	});
	await ticket({ prefix: 'A', number: 2, encounterId: liza.id, station: 'TRIAGE', issuedAt: checkedInAt });

	// Jose, a senior citizen (RA 9994), in the priority lane and with Dr. Reyes now: P-001.
	const jose = demo.encounters.joseToday;
	const joseBooking = await book({
		patient: 'jose',
		start: jose.startedAt,
		visitType: 'NEW_PATIENT',
		channel: 'WALK_IN',
		status: 'IN_PROGRESS',
		reason: 'Sore throat and fever for 3 days',
	});
	await tx.encounter.update({ where: { id: jose.id }, data: { appointmentId: joseBooking.id } });
	await ticket({
		prefix: 'P',
		number: 1,
		isPriority: true,
		priorityReason: 'SENIOR_CITIZEN',
		encounterId: jose.id,
		station: 'DOCTOR',
		status: 'SERVING',
		issuedAt: jose.startedAt,
		calledAt: new Date(jose.startedAt.getTime() + 20 * MINUTE),
		servedAt: new Date(jose.startedAt.getTime() + 21 * MINUTE),
	});
}
