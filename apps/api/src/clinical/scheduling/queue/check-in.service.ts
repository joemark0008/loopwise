import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { EncounterType, VisitType } from '../../../generated/prisma/enums.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditSnapshot } from '../../audit/audit-changes.js';
import { EncounterService } from '../../encounters/encounter.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	appointmentColumns,
	AppointmentRepository,
	type AppointmentRow,
} from '../appointments/appointment.repository.js';
import { AppointmentService } from '../appointments/appointment.service.js';
import { AppointmentSlotService } from '../appointments/appointment-slot.service.js';
import { dateColumn, manilaDate } from '../manila-time.js';
import { QueueStation } from '../scheduling.enums.js';
import { AlreadyCheckedInError, AppointmentNotTodayError, InvalidCheckInError } from '../scheduling.errors.js';
import { type DeskActor, SchedulingAccess } from '../scheduling-access.js';
import type { CheckInPatientInput } from './dto/queue.input.js';
import { type QueueTicket, toQueueTicket } from './models/queue-ticket.model.js';
import { QueueRepository, ticketColumns } from './queue.repository.js';
import { laneOf } from './queue-status.js';

/** The visit's type from the booking's visit type. */
export const ENCOUNTER_TYPE_BY_VISIT: Readonly<Record<VisitType, EncounterType>> = {
	NEW_PATIENT: 'CONSULTATION',
	FOLLOW_UP: 'FOLLOW_UP',
	PROCEDURE: 'PROCEDURE',
	TELECONSULT: 'TELECONSULTATION',
	PEME: 'PEME',
	APE: 'APE',
};

/**
 * Check-in at the front desk (DESIGN.md §2): today's booking, or a walk-in (who gets a WALK_IN appointment, so every
 * visit has its booking). In one transaction: the appointment moves to ARRIVED, the visit opens
 * (`EncounterService.openForCheckIn`: OPEN, `encounterNo`, the doctor, `appointmentId`, the type from the visit type)
 * and the queue ticket is issued in its lane ("P" priority, "A" regular) with the next number of the day.
 */
@Injectable()
export class CheckInService {
	private readonly logger = new Logger(CheckInService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly access: SchedulingAccess,
		private readonly appointments: AppointmentService,
		private readonly appointmentRows: AppointmentRepository,
		private readonly slots: AppointmentSlotService,
		private readonly encounters: EncounterService,
		private readonly queue: QueueRepository,
		private readonly audit: AuditService,
	) {}

	async checkIn(userId: string, input: CheckInPatientInput): Promise<QueueTicket> {
		const actor = await this.access.atClinic(userId, input.clinicId, 'front_desk');
		const today = manilaDate();
		const booking = input.appointmentId
			? await this.requireBooking(userId, actor, input.appointmentId, today)
			: null;
		if (!booking) {
			if (!input.patientId || !input.practitionerId) {
				throw new InvalidCheckInError("A walk-in needs the patient and the doctor whose line they'll join.");
			}
			await this.requirePatient(userId, actor, input.patientId);
		}
		const reason = input.reason?.trim() || null;

		const ticket = await this.db.asSystem(async (tx) => {
			const appointment = booking
				? await this.appointments.transitionOn(tx, userId, booking, 'ARRIVED', actor.clinic.organizationId)
				: await this.walkIn(tx, userId, actor, {
						patientId: input.patientId!,
						practitionerId: input.practitionerId!,
						visitType: input.visitType ?? 'NEW_PATIENT',
						reason,
					});
			const encounter = await this.encounters.openForCheckIn(tx, userId, {
				clinic: actor.clinic,
				patientId: appointment.patientId,
				practitionerId: appointment.practitionerId,
				appointmentId: appointment.id,
				type: ENCOUNTER_TYPE_BY_VISIT[appointment.visitType],
				chiefComplaint: reason ?? appointment.reason,
			});
			const lane = laneOf(input.priorityReason);
			const queueDate = dateColumn(today);
			const row = await this.queue.create(tx, {
				clinicId: actor.clinic.id,
				queueDate,
				prefix: lane.prefix,
				number: await this.queue.nextNumber(tx, { clinicId: actor.clinic.id, queueDate, prefix: lane.prefix }),
				isPriority: lane.isPriority,
				priorityReason: input.priorityReason ?? null,
				practitionerId: appointment.practitionerId,
				encounterId: encounter.id,
				station: input.station ?? QueueStation.TRIAGE,
				status: 'WAITING',
			});
			await this.audit.created(tx, {
				event: 'queue.check_in',
				entityType: 'QueueTicket',
				entityId: row.id,
				userId,
				patientId: appointment.patientId,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				changes: { after: auditSnapshot(ticketColumns(row)) },
				reason: input.priorityReason ? `priority lane: ${input.priorityReason}` : null,
			});
			return row;
		});
		this.logger.log(`Checked in ticket ${ticket.prefix}-${ticket.number} at clinic ${actor.clinic.id}`);
		return toQueueTicket(ticket);
	}

	/** Today's booking at this clinic, not checked in yet. */
	private async requireBooking(
		userId: string,
		actor: DeskActor,
		appointmentId: string,
		today: string,
	): Promise<AppointmentRow> {
		const booking = await this.appointments.requireReadable(userId, appointmentId);
		if (booking.clinicId !== actor.clinic.id) {
			throw new InvalidCheckInError('That booking is at another clinic.');
		}
		if (booking.encounter || booking.status === 'ARRIVED' || booking.status === 'IN_PROGRESS') {
			throw new AlreadyCheckedInError();
		}
		if (manilaDate(booking.scheduledStart) !== today) {
			throw new AppointmentNotTodayError();
		}
		return booking;
	}

	private async requirePatient(userId: string, actor: DeskActor, patientId: string): Promise<void> {
		const patient = await this.db.asUser(userId, (tx) => this.appointmentRows.findPatient(tx, patientId));
		if (!patient || patient.organizationId !== actor.clinic.organizationId) {
			throw new EntityNotFoundError('Patient', patientId);
		}
	}

	/** A walk-in's booking: now, with the doctor whose line they join, already ARRIVED. */
	private async walkIn(
		tx: ClinicalTx,
		userId: string,
		actor: DeskActor,
		visit: { patientId: string; practitionerId: string; visitType: VisitType; reason: string | null },
	): Promise<AppointmentRow> {
		await this.slots.requirePractitioner(tx, visit.practitionerId, actor.clinic.id);
		const row = await this.appointmentRows.create(tx, {
			clinicId: actor.clinic.id,
			patientId: visit.patientId,
			practitionerId: visit.practitionerId,
			scheduledStart: new Date(),
			visitType: visit.visitType,
			channel: 'WALK_IN',
			status: 'ARRIVED',
			reason: visit.reason,
			createdById: userId,
		});
		await this.audit.created(tx, {
			event: 'appointment.walk_in',
			entityType: 'Appointment',
			entityId: row.id,
			userId,
			patientId: row.patientId,
			organizationId: actor.clinic.organizationId,
			clinicId: actor.clinic.id,
			changes: { after: auditSnapshot(appointmentColumns(row)) },
		});
		return row;
	}
}
