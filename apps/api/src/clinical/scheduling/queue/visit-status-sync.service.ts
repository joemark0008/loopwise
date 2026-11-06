import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import type { AppointmentStatus, EncounterStatus } from '../../../generated/prisma/enums.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { type EncounterStatusChanged, EncounterStatusEvents } from '../../encounters/encounter-status-events.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { AppointmentService } from '../appointments/appointment.service.js';
import { canTransitionAppointment } from '../appointments/appointment-status.js';
import { QueueStation } from '../scheduling.enums.js';
import { QueueRepository, ticketColumns } from './queue.repository.js';
import { followVisit } from './queue-status.js';

/** Where the booking goes when the visit moves (none: it stays). */
const BOOKING_FOR_VISIT: Partial<Record<EncounterStatus, AppointmentStatus>> = {
	IN_PROGRESS: 'IN_PROGRESS',
	FOR_BILLING: 'COMPLETED',
	COMPLETED: 'COMPLETED',
	CANCELLED: 'CANCELLED',
};

/**
 * Keeps the queue ticket and the booking in step with a visit moved from outside the queue pages: the encounter page's
 * Start consult, Send to billing, Complete visit and Cancel visit, Wise, or billing completing a paid visit. It
 * listens to `EncounterStatusEvents` (published by `EncounterService.transition` on its own transaction), so the
 * visit, its ticket and its booking commit together. Moves made from the queue pages are `VisitFlowService`'s and are
 * skipped here (`trigger: 'queue'`).
 *
 * | Visit (from the encounter page) | Ticket (`followVisit`)                  | Booking               |
 * | ------------------------------- | --------------------------------------- | --------------------- |
 * | → IN_PROGRESS                   | SERVING at the doctor's room            | ARRIVED → IN_PROGRESS |
 * | → FOR_BILLING                   | WAITING at the cashier                  | → COMPLETED           |
 * | → COMPLETED                     | DONE                                    | → COMPLETED           |
 * | → CANCELLED                     | CANCELLED                               | ARRIVED → CANCELLED   |
 *
 * Runs as system work on the visit's transaction (the user's access to the visit was checked by the transition) and
 * writes an audit row per change, with the user who moved the visit.
 */
@Injectable()
export class VisitStatusSync implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(VisitStatusSync.name);
	private unsubscribe?: () => void;

	constructor(
		private readonly events: EncounterStatusEvents,
		private readonly queue: QueueRepository,
		private readonly appointments: AppointmentService,
		private readonly audit: AuditService,
	) {}

	onModuleInit(): void {
		this.unsubscribe = this.events.subscribe((tx, event) => this.follow(tx, event));
	}

	onModuleDestroy(): void {
		this.unsubscribe?.();
	}

	/** Moves the visit's open ticket and its booking to where the visit's new status puts them. */
	async follow(tx: ClinicalTx, event: EncounterStatusChanged): Promise<void> {
		if (event.trigger === 'queue') {
			return;
		}
		await this.moveTicket(tx, event);
		await this.moveBooking(tx, event);
	}

	private async moveTicket(tx: ClinicalTx, event: EncounterStatusChanged): Promise<void> {
		const ticket = await this.queue.findOpenByEncounter(tx, event.encounterId);
		const change = ticket && followVisit(ticket, event.to);
		if (!ticket || !change) {
			return;
		}
		const toDoctor = change.station === QueueStation.DOCTOR && event.practitionerId;
		const row = await this.queue.update(tx, ticket.id, ticket.status, {
			...change,
			...(toDoctor && { practitionerId: event.practitionerId }),
		});
		if (!row) {
			// Another desk moved the ticket in the meantime: the visit's move stands, the ticket is theirs.
			this.logger.warn(`Ticket ${ticket.id} moved meanwhile; left at ${ticket.station}`);
			return;
		}
		await this.audit.updated(tx, {
			event: `queue.follow_visit_${event.to.toLowerCase()}`,
			entityType: 'QueueTicket',
			entityId: ticket.id,
			userId: event.userId,
			patientId: event.patientId,
			organizationId: event.organizationId,
			clinicId: ticket.clinicId,
			changes: auditChanges(ticketColumns(ticket), ticketColumns(row)),
			reason: event.reason,
		});
	}

	private async moveBooking(tx: ClinicalTx, event: EncounterStatusChanged): Promise<void> {
		const to = BOOKING_FOR_VISIT[event.to];
		const booking = to && event.appointmentId ? await this.appointments.findOn(tx, event.appointmentId) : null;
		if (!to || !booking || booking.status === to) {
			return;
		}
		if (!canTransitionAppointment(booking.status, to)) {
			this.logger.warn(`Booking ${booking.id} stays ${booking.status} (visit went ${event.to})`);
			return;
		}
		await this.appointments.transitionOn(
			tx,
			event.userId,
			booking,
			to,
			event.organizationId,
			to === 'CANCELLED' ? (event.reason ?? 'Visit cancelled') : undefined,
		);
	}
}
