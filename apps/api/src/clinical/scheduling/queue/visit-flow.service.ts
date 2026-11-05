import { Injectable, Logger } from '@nestjs/common';

import type { AppointmentStatus, EncounterStatus } from '../../../generated/prisma/enums.js';
import { EncounterService } from '../../encounters/encounter.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { AppointmentService } from '../appointments/appointment.service.js';
import { canTransitionAppointment } from '../appointments/appointment-status.js';
import { QueueStation } from '../scheduling.enums.js';
import { CancelReasonRequiredError, InvalidQueueStationError, VisitAlreadyStartedError } from '../scheduling.errors.js';
import { SchedulingAccess } from '../scheduling-access.js';
import type { CancelQueueTicketInput, SendQueueTicketInput } from './dto/queue.input.js';
import { type QueueTicket, toQueueTicket } from './models/queue-ticket.model.js';
import type { QueueTicketRow } from './queue.repository.js';
import { QueueService, type TicketContext } from './queue.service.js';
import { callTicket, cancelTicket, finishTicket, serveTicket, transferTicket } from './queue-status.js';

/** Where a station may send its patient next. */
const NEXT_STATIONS: Readonly<Record<QueueStation, readonly QueueStation[]>> = {
	TRIAGE: [QueueStation.DOCTOR],
	DOCTOR: [QueueStation.CASHIER],
	CASHIER: [],
};

/**
 * The queue moves that also move the visit and its booking, so the three stay in step (DESIGN.md §2):
 *
 * | Queue move                         | Visit (`EncounterService.transition`) | Appointment            |
 * | ---------------------------------- | ------------------------------------- | ---------------------- |
 * | start at the doctor's room         | OPEN → IN_PROGRESS                    | ARRIVED → IN_PROGRESS  |
 * | doctor sends to the cashier        | IN_PROGRESS → FOR_BILLING             | → COMPLETED            |
 * | doctor finishes (nothing to bill)  | IN_PROGRESS → COMPLETED               | → COMPLETED            |
 * | cancel (left before the doctor)    | OPEN → CANCELLED, with the reason     | ARRIVED → CANCELLED    |
 *
 * The visit moves first, through the encounters module (its own transaction, status machine and audit row); the ticket
 * and the booking follow in one transaction as the user. A visit already moved (the doctor started it from the chart)
 * is left as it is.
 */
@Injectable()
export class VisitFlowService {
	private readonly logger = new Logger(VisitFlowService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly queue: QueueService,
		private readonly access: SchedulingAccess,
		private readonly encounters: EncounterService,
		private readonly appointments: AppointmentService,
	) {}

	/** The patient is at the station (called first if they were still waiting). At the doctor's room, the visit starts. */
	async start(userId: string, ticketId: string): Promise<QueueTicket> {
		const context = await this.queue.requireTicket(userId, ticketId);
		await this.queue.requireStationDesk(context);
		const atDoctor = context.ticket.station === QueueStation.DOCTOR;
		// Refuse a ticket that can't be served before the visit moves.
		serveTicket(context.ticket.status === 'WAITING' ? 'CALLED' : context.ticket.status);
		if (atDoctor) {
			await this.moveVisit(userId, context.ticket, ['OPEN'], 'IN_PROGRESS');
		}
		// The booking moves first in each transaction below, so the ticket read back shows it moved.
		return this.db.asUser(userId, async (tx) => {
			if (atDoctor) {
				await this.moveBooking(tx, context, 'IN_PROGRESS');
			}
			let current = context;
			if (current.ticket.status === 'WAITING') {
				current = {
					...current,
					ticket: await this.queue.applyOrConflict(tx, current, callTicket('WAITING'), 'queue.call'),
				};
			}
			const row = await this.queue.applyOrConflict(
				tx,
				current,
				serveTicket(current.ticket.status),
				'queue.serve',
			);
			return toQueueTicket(row);
		});
	}

	/** Sends the patient being served on: triage → the doctor's line, the doctor → the cashier (the visit goes to billing). */
	async send(userId: string, input: SendQueueTicketInput): Promise<QueueTicket> {
		const context = await this.queue.requireTicket(userId, input.ticketId);
		await this.queue.requireStationDesk(context);
		const from = (context.ticket.station ?? QueueStation.TRIAGE) as QueueStation;
		if (!NEXT_STATIONS[from].includes(input.station)) {
			throw new InvalidQueueStationError(
				`A patient at ${from.toLowerCase()} can't be sent to ${input.station.toLowerCase()}.`,
			);
		}
		if (input.station === QueueStation.DOCTOR && !context.ticket.practitionerId) {
			throw new InvalidQueueStationError('The ticket has no doctor to send the patient to.');
		}
		const change = transferTicket(context.ticket.status, input.station);
		const leavesDoctor = from === QueueStation.DOCTOR;
		if (leavesDoctor) {
			await this.moveVisit(userId, context.ticket, ['IN_PROGRESS'], 'FOR_BILLING');
		}
		return this.db.asUser(userId, async (tx) => {
			if (leavesDoctor) {
				await this.moveBooking(tx, context, 'COMPLETED');
			}
			const row = await this.queue.applyOrConflict(
				tx,
				context,
				change,
				`queue.send_${input.station.toLowerCase()}`,
			);
			return toQueueTicket(row);
		});
	}

	/** The patient leaves the lines: at the cashier once paid, or from the doctor when there is nothing to bill. */
	async complete(userId: string, ticketId: string): Promise<QueueTicket> {
		const context = await this.queue.requireTicket(userId, ticketId);
		await this.queue.requireStationDesk(context);
		const change = finishTicket(context.ticket.status);
		const atDoctor = context.ticket.station === QueueStation.DOCTOR;
		if (!atDoctor && context.ticket.station !== QueueStation.CASHIER) {
			throw new InvalidQueueStationError('Send the patient to the doctor; triage is not the end of a visit.');
		}
		if (atDoctor) {
			await this.moveVisit(userId, context.ticket, ['IN_PROGRESS'], 'COMPLETED');
		}
		return this.db.asUser(userId, async (tx) => {
			if (atDoctor) {
				await this.moveBooking(tx, context, 'COMPLETED');
			}
			return toQueueTicket(await this.queue.applyOrConflict(tx, context, change, 'queue.done'));
		});
	}

	/**
	 * The patient left before the doctor started the visit: the ticket, the visit and the booking are cancelled with the
	 * reason. The front desk or the station's desk.
	 */
	async cancel(userId: string, input: CancelQueueTicketInput): Promise<QueueTicket> {
		const reason = input.reason.trim();
		if (!reason) {
			throw new CancelReasonRequiredError();
		}
		const context = await this.queue.requireTicket(userId, input.ticketId);
		if (!this.access.works(context.actor, 'front_desk')) {
			await this.queue.requireStationDesk(context);
		}
		const visit = context.ticket.encounter;
		if (visit && visit.status !== 'OPEN' && visit.status !== 'CANCELLED') {
			throw new VisitAlreadyStartedError();
		}
		const change = cancelTicket(context.ticket.status);
		await this.moveVisit(userId, context.ticket, ['OPEN'], 'CANCELLED', reason);
		return this.db.asUser(userId, async (tx) => {
			await this.moveBooking(tx, context, 'CANCELLED', reason);
			return toQueueTicket(await this.queue.applyOrConflict(tx, context, change, 'queue.cancel', reason));
		});
	}

	/** Moves the ticket's visit to `to` when it is in one of `from` (a visit moved elsewhere already is left alone). */
	private async moveVisit(
		userId: string,
		ticket: QueueTicketRow,
		from: readonly EncounterStatus[],
		to: EncounterStatus,
		reason?: string,
	): Promise<void> {
		const visit = ticket.encounter;
		if (!visit || !from.includes(visit.status)) {
			return;
		}
		await this.encounters.transition(userId, {
			encounterId: visit.id,
			status: to,
			expectedVersion: visit.version,
			reason: reason ?? null,
		});
	}

	/** Moves the ticket's booking along with it, when its status machine allows (on the ticket's transaction). */
	private async moveBooking(
		tx: ClinicalTx,
		{ ticket, actor }: TicketContext,
		to: AppointmentStatus,
		reason?: string,
	): Promise<void> {
		const appointmentId = ticket.encounter?.appointment?.id;
		const booking = appointmentId ? await this.appointments.findOn(tx, appointmentId) : null;
		if (!booking) {
			return;
		}
		// A visit the doctor ended from the chart left the booking ARRIVED: it completes straight from there.
		if (canTransitionAppointment(booking.status, to)) {
			await this.appointments.transitionOn(tx, actor.userId, booking, to, actor.clinic.organizationId, reason);
		} else if (booking.status !== to) {
			this.logger.warn(`Booking ${booking.id} stays ${booking.status} (queue asked for ${to})`);
		}
	}
}
