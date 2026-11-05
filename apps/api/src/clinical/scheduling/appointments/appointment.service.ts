import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { AppointmentStatus } from '../../../generated/prisma/enums.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import { manilaRange } from '../manila-time.js';
import { AlreadyCheckedInError, CancelReasonRequiredError, NoShowTooEarlyError } from '../scheduling.errors.js';
import { type DeskActor, SchedulingAccess } from '../scheduling-access.js';
import { appointmentColumns, AppointmentRepository, type AppointmentRow } from './appointment.repository.js';
import { AppointmentSlotService } from './appointment-slot.service.js';
import { transitionAppointment } from './appointment-status.js';
import type {
	BookAppointmentInput,
	CancelAppointmentInput,
	ClinicAppointmentsInput,
	RescheduleAppointmentInput,
} from './dto/appointment.input.js';
import { type Appointment, toAppointment } from './models/appointment.model.js';

/**
 * Appointments (DESIGN.md §5.2): booking into a doctor's open slot, rescheduling (the old booking is kept as
 * RESCHEDULED and the new one points back at it), cancelling with a reason, confirming and marking a no-show. The front
 * desk (RECEPTIONIST) and clinic admins change bookings; any staff of the clinic read them, and row-level security
 * decides which patients each one sees. Every change writes its audit row in the same transaction.
 */
@Injectable()
export class AppointmentService {
	private readonly logger = new Logger(AppointmentService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly appointments: AppointmentRepository,
		private readonly slots: AppointmentSlotService,
		private readonly access: SchedulingAccess,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The clinic's appointments over 1–7 days, by time: the day and week views, per doctor or for the clinic. */
	async list(userId: string, input: ClinicAppointmentsInput): Promise<Appointment[]> {
		await this.access.atClinic(userId, input.clinicId);
		const { start, end } = manilaRange(input.from, input.days ?? 1);
		return this.db.asUser(userId, async (tx) =>
			(
				await this.appointments.listInRange(tx, {
					clinicId: input.clinicId,
					from: start,
					to: end,
					practitionerId: input.practitionerId,
					statuses: input.statuses,
				})
			).map(toAppointment),
		);
	}

	/**
	 * Books the patient into one of the doctor's open slots. With `wiseOrigin` (a `propose_appointment` card), the card
	 * is verified and settled in the same transaction.
	 */
	async book(userId: string, input: BookAppointmentInput): Promise<Appointment> {
		const actor = await this.access.atClinic(userId, input.clinicId, 'front_desk');
		const card = await this.wiseProposals.verifyAction(
			userId,
			input.wiseOrigin,
			'bookAppointment',
			actor.clinic.organizationId,
		);
		assertCardPatient(card, input.patientId);
		await this.requirePatient(userId, actor, input.patientId);
		const start = new Date(input.scheduledStart);

		return this.db.asSystem(async (tx) => {
			await this.slots.requirePractitioner(tx, input.practitionerId, actor.clinic.id);
			const slot = await this.slots.requireBookable(tx, {
				clinicId: actor.clinic.id,
				practitionerId: input.practitionerId,
				start,
			});
			const row = await this.appointments.create(tx, {
				clinicId: actor.clinic.id,
				patientId: input.patientId,
				practitionerId: input.practitionerId,
				scheduledStart: slot.start,
				scheduledEnd: slot.end,
				visitType: input.visitType ?? 'NEW_PATIENT',
				channel: input.channel ?? 'PHONE',
				status: 'SCHEDULED',
				reason: input.reason?.trim() || null,
				notes: input.notes?.trim() || null,
				createdById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'Appointment', entityId: row.id });
			await this.audit.created(tx, {
				event: 'appointment.book',
				entityType: 'Appointment',
				entityId: row.id,
				userId,
				patientId: row.patientId,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				changes: { after: auditSnapshot(appointmentColumns(row)) },
				origin: card?.origin,
			});
			return toAppointment(row);
		});
	}

	/**
	 * Moves an upcoming booking to another open slot (of the same or another doctor at the clinic): the old one becomes
	 * RESCHEDULED in the same transaction, which frees its slot, and the new one keeps `rescheduledFrom`.
	 */
	async reschedule(userId: string, input: RescheduleAppointmentInput): Promise<Appointment> {
		const current = await this.requireReadable(userId, input.appointmentId);
		const actor = await this.access.atClinic(userId, current.clinicId, 'front_desk');
		const card = await this.wiseProposals.verifyAction(
			userId,
			input.wiseOrigin,
			'rescheduleAppointment',
			actor.clinic.organizationId,
		);
		assertCardPatient(card, current.patientId);
		const change = transitionAppointment(current.status, 'RESCHEDULED');
		const practitionerId = input.practitionerId ?? current.practitionerId;
		const start = new Date(input.scheduledStart);
		const reason = input.reason?.trim() || null;

		return this.db.asSystem(async (tx) => {
			await this.slots.requirePractitioner(tx, practitionerId, actor.clinic.id);
			const old = await this.appointments.update(tx, current.id, change);
			const slot = await this.slots.requireBookable(tx, { clinicId: actor.clinic.id, practitionerId, start });
			const row = await this.appointments.create(tx, {
				clinicId: actor.clinic.id,
				patientId: current.patientId,
				practitionerId,
				scheduledStart: slot.start,
				scheduledEnd: slot.end,
				visitType: current.visitType,
				channel: current.channel,
				status: 'SCHEDULED',
				reason: current.reason,
				notes: current.notes,
				rescheduledFrom: current.id,
				createdById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'Appointment', entityId: row.id });
			const entry = {
				userId,
				patientId: current.patientId,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				reason,
				origin: card?.origin,
			};
			await this.audit.updated(tx, {
				...entry,
				event: 'appointment.reschedule',
				entityType: 'Appointment',
				entityId: current.id,
				changes: auditChanges(snapshot(current), snapshot(old)),
			});
			await this.audit.created(tx, {
				...entry,
				event: 'appointment.book',
				entityType: 'Appointment',
				entityId: row.id,
				changes: { after: auditSnapshot(appointmentColumns(row)) },
			});
			return toAppointment(row);
		});
	}

	/** Cancels an upcoming booking with its reason (a checked-in patient's visit is cancelled from the queue). */
	async cancel(userId: string, input: CancelAppointmentInput): Promise<Appointment> {
		const reason = input.reason.trim();
		if (!reason) {
			throw new CancelReasonRequiredError();
		}
		return this.move(userId, input.appointmentId, 'CANCELLED', { cancelledReason: reason }, reason);
	}

	/** The patient confirmed (by text, call, Messenger). */
	confirm(userId: string, appointmentId: string): Promise<Appointment> {
		return this.move(userId, appointmentId, 'CONFIRMED');
	}

	/** The patient didn't come: only once the booked time has passed. */
	markNoShow(userId: string, appointmentId: string): Promise<Appointment> {
		return this.move(userId, appointmentId, 'NO_SHOW');
	}

	/**
	 * Moves an appointment along its status machine on the caller's transaction, with its audit row: the queue's check-in,
	 * the doctor's start and the end of the visit keep the booking in step through here.
	 */
	async transitionOn(
		tx: ClinicalTx,
		userId: string,
		row: AppointmentRow,
		to: AppointmentStatus,
		organizationId: string,
		cancelledReason?: string,
	): Promise<AppointmentRow> {
		const after = await this.appointments.update(tx, row.id, {
			...transitionAppointment(row.status, to),
			...(cancelledReason && { cancelledReason }),
		});
		await this.audit.updated(tx, {
			event: `appointment.${to.toLowerCase()}`,
			entityType: 'Appointment',
			entityId: row.id,
			userId,
			patientId: row.patientId,
			organizationId,
			clinicId: row.clinicId,
			changes: auditChanges(snapshot(row), snapshot(after)),
			reason: cancelledReason ?? null,
		});
		return after;
	}

	/** The appointment on the caller's transaction (row-level security as that transaction allows), or null. */
	findOn(tx: ClinicalTx, appointmentId: string): Promise<AppointmentRow | null> {
		return this.appointments.findById(tx, appointmentId);
	}

	/** The appointment as the user may see it, else not found. */
	async requireReadable(userId: string, appointmentId: string): Promise<AppointmentRow> {
		const row = await this.db.asUser(userId, (tx) => this.appointments.findById(tx, appointmentId));
		if (!row) {
			throw new EntityNotFoundError('Appointment', appointmentId);
		}
		return row;
	}

	private async move(
		userId: string,
		appointmentId: string,
		to: 'CANCELLED' | 'CONFIRMED' | 'NO_SHOW',
		data: { cancelledReason?: string } = {},
		reason: string | null = null,
	): Promise<Appointment> {
		const current = await this.requireReadable(userId, appointmentId);
		const actor = await this.access.atClinic(userId, current.clinicId, 'front_desk');
		if (current.status === 'ARRIVED' || current.status === 'IN_PROGRESS') {
			throw new AlreadyCheckedInError();
		}
		if (to === 'NO_SHOW' && current.scheduledStart > new Date()) {
			throw new NoShowTooEarlyError();
		}
		const change = transitionAppointment(current.status, to);
		return this.db.asUser(userId, async (tx) => {
			const row = await this.appointments.update(tx, current.id, { ...change, ...data });
			await this.audit.updated(tx, {
				event: `appointment.${to.toLowerCase()}`,
				entityType: 'Appointment',
				entityId: row.id,
				userId,
				patientId: row.patientId,
				organizationId: actor.clinic.organizationId,
				clinicId: row.clinicId,
				changes: auditChanges(snapshot(current), snapshot(row)),
				reason,
			});
			this.logger.log(`Appointment ${row.id} → ${row.status}`);
			return toAppointment(row);
		});
	}

	/** The patient, when the user may see them and they belong to the clinic's organization. */
	private async requirePatient(userId: string, actor: DeskActor, patientId: string): Promise<void> {
		const patient = await this.db.asUser(userId, (tx) => this.appointments.findPatient(tx, patientId));
		if (!patient || patient.organizationId !== actor.clinic.organizationId) {
			throw new EntityNotFoundError('Patient', patientId);
		}
	}
}

function snapshot(row: AppointmentRow) {
	return {
		status: row.status,
		scheduledStart: row.scheduledStart,
		practitionerId: row.practitionerId,
		cancelledReason: row.cancelledReason,
	};
}
