import { Injectable } from '@nestjs/common';

import type { Appointment, AppointmentStatus, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { ACTIVE_APPOINTMENT_STATUSES } from './appointment-status.js';

const PERSON = { select: { id: true, firstName: true, middleName: true, lastName: true } } as const;

export const APPOINTMENT_INCLUDE = {
	patient: { select: { ...PERSON.select, patientNo: true, birthDate: true, sex: true, mobileNo: true } },
	practitioner: {
		select: { ...PERSON.select, title: true, suffix: true, postNominals: true, userId: true, clinics: true },
	},
	encounter: { select: { id: true, encounterNo: true, status: true } },
} satisfies Prisma.AppointmentInclude;

/** An appointment with the names the desk shows: patient, doctor (and their rooms), and the visit once checked in. */
export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof APPOINTMENT_INCLUDE }>;

/** The doctor at a clinic: their name and room there. */
export type PractitionerAtClinic = AppointmentRow['practitioner'];

/**
 * Appointments. Every method takes the caller's transaction: `asUser` (row-level security: staff of the clinic who may
 * see the patient) or `asSystem` for capacity counts across every patient and the reminder job.
 */
@Injectable()
export class AppointmentRepository {
	findById(tx: ClinicalTx, id: string): Promise<AppointmentRow | null> {
		return tx.appointment.findUnique({ where: { id }, include: APPOINTMENT_INCLUDE });
	}

	/** The clinic's appointments starting in `[from, to)`, by time (optionally one doctor's, some statuses). */
	listInRange(
		tx: ClinicalTx,
		query: {
			clinicId: string;
			from: Date;
			to: Date;
			practitionerId?: string | null;
			patientId?: string | null;
			statuses?: readonly AppointmentStatus[] | null;
		},
	): Promise<AppointmentRow[]> {
		return tx.appointment.findMany({
			where: {
				clinicId: query.clinicId,
				scheduledStart: { gte: query.from, lt: query.to },
				...(query.practitionerId && { practitionerId: query.practitionerId }),
				...(query.patientId && { patientId: query.patientId }),
				...(query.statuses?.length && { status: { in: [...query.statuses] } }),
			},
			include: APPOINTMENT_INCLUDE,
			orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
		});
	}

	/**
	 * Start times of the doctor's bookings that hold a slot in `[from, to)`, at every clinic (system work: capacity
	 * counts every patient). Walk-ins count against the session's cap too.
	 */
	activeBookings(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<{ start: Date }[]> {
		return tx.appointment
			.findMany({
				where: {
					practitionerId,
					scheduledStart: { gte: from, lt: to },
					status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
				},
				select: { scheduledStart: true },
			})
			.then((rows) => rows.map((row) => ({ start: row.scheduledStart })));
	}

	/**
	 * Serializes bookings of one doctor's day (a transaction-scoped advisory lock), so two desks can't take the same
	 * slot or overfill a session between the check and the insert.
	 */
	async lockPractitionerDay(tx: ClinicalTx, practitionerId: string, date: string): Promise<void> {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`appointments:${practitionerId}:${date}`}, 0))`;
	}

	/** The doctor when they hold clinic at the clinic (active), else null. */
	practitionerAtClinic(
		tx: ClinicalTx,
		practitionerId: string,
		clinicId: string,
	): Promise<PractitionerAtClinic | null> {
		return tx.practitioner.findFirst({
			where: {
				id: practitionerId,
				isActive: true,
				deletedAt: null,
				clinics: { some: { clinicId, isActive: true } },
			},
			select: APPOINTMENT_INCLUDE.practitioner.select,
		});
	}

	/** The active doctors holding clinic at the clinic, by name. */
	practitionersAtClinic(tx: ClinicalTx, clinicId: string): Promise<PractitionerAtClinic[]> {
		return tx.practitioner.findMany({
			where: { isActive: true, deletedAt: null, clinics: { some: { clinicId, isActive: true } } },
			select: APPOINTMENT_INCLUDE.practitioner.select,
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
		});
	}

	/** The practitioner profile of a user, or null. */
	practitionerOfUser(tx: ClinicalTx, userId: string): Promise<{ id: string } | null> {
		return tx.practitioner.findUnique({ where: { userId }, select: { id: true } });
	}

	/** The patient's organization when the user may see them (row-level security), else null. */
	findPatient(tx: ClinicalTx, patientId: string): Promise<{ id: string; organizationId: string } | null> {
		return tx.patient.findFirst({
			where: { id: patientId, deletedAt: null },
			select: { id: true, organizationId: true },
		});
	}

	create(tx: ClinicalTx, data: Prisma.AppointmentUncheckedCreateInput): Promise<AppointmentRow> {
		return tx.appointment.create({ data, include: APPOINTMENT_INCLUDE });
	}

	update(tx: ClinicalTx, id: string, data: Prisma.AppointmentUncheckedUpdateInput): Promise<AppointmentRow> {
		return tx.appointment.update({ where: { id }, data, include: APPOINTMENT_INCLUDE });
	}

	/** Upcoming bookings in `[from, to)` not reminded yet, at every clinic (the reminder job, system work). */
	dueForReminder(
		tx: ClinicalTx,
		from: Date,
		to: Date,
		take: number,
	): Promise<(Appointment & AppointmentReminderParts)[]> {
		return tx.appointment.findMany({
			where: {
				scheduledStart: { gte: from, lt: to },
				status: { in: ['SCHEDULED', 'CONFIRMED'] },
				reminderSentAt: null,
			},
			include: {
				clinic: { select: { name: true, code: true, organizationId: true } },
				patient: { select: { mobileNo: true, preferredLanguage: true } },
			},
			orderBy: { scheduledStart: 'asc' },
			take,
		});
	}

	/** Marks the reminder sent unless another run did (returns false then). */
	async markReminded(tx: ClinicalTx, id: string, at: Date): Promise<boolean> {
		const { count } = await tx.appointment.updateMany({
			where: { id, reminderSentAt: null },
			data: { reminderSentAt: at },
		});
		return count === 1;
	}
}

/** The appointment's own columns, for an audit snapshot (no joined names). */
export function appointmentColumns(row: Appointment): Omit<Appointment, 'createdAt' | 'updatedAt'> {
	return {
		id: row.id,
		clinicId: row.clinicId,
		patientId: row.patientId,
		practitionerId: row.practitionerId,
		scheduledStart: row.scheduledStart,
		scheduledEnd: row.scheduledEnd,
		visitType: row.visitType,
		channel: row.channel,
		status: row.status,
		reason: row.reason,
		notes: row.notes,
		reminderSentAt: row.reminderSentAt,
		cancelledReason: row.cancelledReason,
		rescheduledFrom: row.rescheduledFrom,
		createdById: row.createdById,
	};
}

export interface AppointmentReminderParts {
	clinic: { name: string; code: string; organizationId: string };
	patient: { mobileNo: string | null; preferredLanguage: string | null };
}
