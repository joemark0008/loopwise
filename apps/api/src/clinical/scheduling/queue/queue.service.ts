import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { dateColumn, manilaDate } from '../manila-time.js';
import { QueueStation } from '../scheduling.enums.js';
import { InvalidQueueStationError, NotYourQueueLineError, QueueTicketMovedError } from '../scheduling.errors.js';
import { type DeskActor, SchedulingAccess } from '../scheduling-access.js';
import type { CallNextInput, QueueTicketsInput } from './dto/queue.input.js';
import { type QueueBoard, type QueueTicket, toBoardTicket, toQueueTicket } from './models/queue-ticket.model.js';
import { QueueRepository, type QueueTicketRow, ticketColumns } from './queue.repository.js';
import { callTicket, type QueueTicketChange, requeueTicket, skipTicket } from './queue-status.js';

/** A ticket the user is about to move, with who they are at its clinic. */
export interface TicketContext {
	ticket: QueueTicketRow;
	actor: DeskActor;
}

/**
 * The clinic's queue (DESIGN.md §2): the day's lines per station, the waiting-room board, and the moves that stay in
 * the queue (call, skip, requeue). Each station is worked by its desk: triage by nurses, a doctor's room by that doctor,
 * the cashier by the billing desk; clinic admins work every desk. The moves that also change the visit (the doctor's
 * start, sending on, finishing, cancelling) are `VisitFlowService`'s.
 */
@Injectable()
export class QueueService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly queue: QueueRepository,
		private readonly appointments: AppointmentRepository,
		private readonly access: SchedulingAccess,
		private readonly audit: AuditService,
	) {}

	/** A day's tickets at the clinic: every line, one station, one doctor's line, or the user's own line. */
	async list(userId: string, input: QueueTicketsInput): Promise<QueueTicket[]> {
		await this.access.atClinic(userId, input.clinicId);
		return this.db.asUser(userId, async (tx) => {
			const practitionerId = input.mine ? await this.myPractitionerId(tx, userId) : input.practitionerId;
			if (input.mine && !practitionerId) {
				// No practitioner profile: no line of their own (never every doctor's).
				return [];
			}
			const rows = await this.queue.listForDay(tx, {
				clinicId: input.clinicId,
				queueDate: dateColumn(input.date ?? manilaDate()),
				station: input.mine ? QueueStation.DOCTOR : input.station,
				practitionerId,
				statuses: input.statuses,
			});
			return rows.map(toQueueTicket);
		});
	}

	/** The waiting-room board today: numbers and stations only (read as system work: no patient data leaves). */
	async board(userId: string, clinicId: string): Promise<QueueBoard> {
		const actor = await this.access.atClinic(userId, clinicId);
		const date = manilaDate();
		const rows = await this.db.asSystem((tx) => this.queue.listForBoard(tx, clinicId, dateColumn(date)));
		const tickets = rows.map((row) => toBoardTicket(row, clinicId));
		return {
			clinicName: actor.clinic.name,
			date,
			nowServing: tickets
				.filter((ticket) => ticket.status !== 'WAITING')
				.sort((a, b) => (b.calledAt?.getTime() ?? 0) - (a.calledAt?.getTime() ?? 0)),
			waiting: tickets.filter((ticket) => ticket.status === 'WAITING'),
		};
	}

	/**
	 * Calls the next patient at a station: the priority lane first, then by arrival. At the doctor's room, the doctor's
	 * own line (an admin may name the doctor). Null when nobody is waiting.
	 */
	async callNext(userId: string, input: CallNextInput): Promise<QueueTicket | null> {
		const actor = await this.access.atClinic(userId, input.clinicId);
		return this.db.asUser(userId, async (tx) => {
			let practitionerId: string | null = null;
			if (input.station === QueueStation.DOCTOR) {
				this.access.require(actor, 'doctor');
				const mine = await this.myPractitionerId(tx, userId);
				practitionerId = input.practitionerId ?? mine;
				if (!practitionerId) {
					throw new InvalidQueueStationError("Name the doctor whose line you're calling.");
				}
				if (practitionerId !== mine && !actor.isAdmin) {
					throw new NotYourQueueLineError();
				}
			} else {
				this.access.require(actor, input.station === QueueStation.TRIAGE ? 'triage' : 'cashier');
			}
			const waiting = await this.queue.listForDay(tx, {
				clinicId: input.clinicId,
				queueDate: dateColumn(manilaDate()),
				station: input.station,
				practitionerId,
				statuses: ['WAITING'],
			});
			for (const ticket of waiting) {
				// Another desk may call the same patient first: the update only wins while the ticket still waits.
				const called = await this.apply(tx, { ticket, actor }, callTicket(ticket.status), 'queue.call');
				if (called) {
					return toQueueTicket(called);
				}
			}
			return null;
		});
	}

	/** Calls one waiting patient out of turn (or again). */
	call(userId: string, ticketId: string): Promise<QueueTicket> {
		return this.moveAtStation(userId, ticketId, (ticket) => callTicket(ticket.status), 'queue.call');
	}

	/** Not there when called: off the board until they come back. */
	skip(userId: string, ticketId: string): Promise<QueueTicket> {
		return this.moveAtStation(userId, ticketId, (ticket) => skipTicket(ticket.status), 'queue.skip');
	}

	/** A skipped patient came back: in line again at the same station, keeping the number. */
	async requeue(userId: string, ticketId: string): Promise<QueueTicket> {
		const context = await this.requireTicket(userId, ticketId);
		if (!this.access.works(context.actor, 'front_desk')) {
			await this.requireStationDesk(context);
		}
		return this.db.asUser(userId, async (tx) =>
			toQueueTicket(
				await this.applyOrConflict(tx, context, requeueTicket(context.ticket.status), 'queue.requeue'),
			),
		);
	}

	/** The ticket as the user may see it, with who they are at its clinic. */
	async requireTicket(userId: string, ticketId: string): Promise<TicketContext> {
		const ticket = await this.db.asUser(userId, (tx) => this.queue.findById(tx, ticketId));
		if (!ticket) {
			throw new EntityNotFoundError('QueueTicket', ticketId);
		}
		return { ticket, actor: await this.access.atClinic(userId, ticket.clinicId) };
	}

	/**
	 * The desk of the ticket's station: nurses at triage, the cashier desk at the cashier, and at a doctor's room that
	 * doctor (or a clinic admin).
	 */
	async requireStationDesk({ ticket, actor }: TicketContext): Promise<void> {
		if (ticket.station === QueueStation.DOCTOR) {
			this.access.require(actor, 'doctor');
			const mine = await this.db.asUser(actor.userId, (tx) => this.myPractitionerId(tx, actor.userId));
			if (!actor.isAdmin && ticket.practitionerId !== mine) {
				throw new NotYourQueueLineError();
			}
			return;
		}
		this.access.require(actor, ticket.station === QueueStation.CASHIER ? 'cashier' : 'triage');
	}

	/**
	 * Moves the ticket on the caller's transaction, with its audit row; STALE when another desk moved it first (the
	 * update only applies while its status is unchanged).
	 */
	async applyOrConflict(
		tx: ClinicalTx,
		context: TicketContext,
		change: QueueTicketChange,
		event: string,
		reason?: string | null,
	): Promise<QueueTicketRow> {
		const row = await this.apply(tx, context, change, event, reason);
		if (!row) {
			throw new QueueTicketMovedError();
		}
		return row;
	}

	/** The user's practitioner id, or null. */
	async myPractitionerId(tx: ClinicalTx, userId: string): Promise<string | null> {
		return (await this.appointments.practitionerOfUser(tx, userId))?.id ?? null;
	}

	private async moveAtStation(
		userId: string,
		ticketId: string,
		change: (ticket: QueueTicketRow) => QueueTicketChange,
		event: string,
	): Promise<QueueTicket> {
		const context = await this.requireTicket(userId, ticketId);
		await this.requireStationDesk(context);
		return this.db.asUser(userId, async (tx) =>
			toQueueTicket(await this.applyOrConflict(tx, context, change(context.ticket), event)),
		);
	}

	private async apply(
		tx: ClinicalTx,
		{ ticket, actor }: TicketContext,
		change: QueueTicketChange,
		event: string,
		reason: string | null = null,
	): Promise<QueueTicketRow | null> {
		const row = await this.queue.update(tx, ticket.id, ticket.status, change);
		if (!row) {
			return null;
		}
		await this.audit.updated(tx, {
			event,
			entityType: 'QueueTicket',
			entityId: ticket.id,
			userId: actor.userId,
			patientId: ticket.encounter?.patientId ?? null,
			organizationId: actor.clinic.organizationId,
			clinicId: ticket.clinicId,
			changes: auditChanges(ticketColumns(ticket), ticketColumns(row)),
			reason,
		});
		return row;
	}
}
