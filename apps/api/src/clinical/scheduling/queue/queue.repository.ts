import { Injectable } from '@nestjs/common';

import type { Prisma, QueueStatus } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { APPOINTMENT_INCLUDE } from '../appointments/appointment.repository.js';

const TICKET_INCLUDE = {
	clinic: { select: { id: true, code: true, organizationId: true } },
	practitioner: { select: APPOINTMENT_INCLUDE.practitioner.select },
	encounter: {
		select: {
			id: true,
			encounterNo: true,
			status: true,
			chiefComplaint: true,
			version: true,
			patientId: true,
			patient: APPOINTMENT_INCLUDE.patient,
			appointment: { select: { id: true, status: true, scheduledStart: true, visitType: true } },
		},
	},
} satisfies Prisma.QueueTicketInclude;

/** A ticket with its doctor, and its visit and patient when the user may see them. */
export type QueueTicketRow = Prisma.QueueTicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

/**
 * Queue tickets. Every method takes the caller's transaction: `asUser` (row-level security: staff of the clinic; the
 * visit and patient only when the user may see them) or `asSystem` (check-in, the board's numbers).
 */
@Injectable()
export class QueueRepository {
	/**
	 * The next number of a lane on a day at the clinic, on the caller's transaction: a transaction-scoped advisory lock
	 * serializes the lane, so two desks never issue the same number (the unique index backs it up).
	 */
	async nextNumber(tx: ClinicalTx, lane: { clinicId: string; queueDate: Date; prefix: string }): Promise<number> {
		const key = `queue:${lane.clinicId}:${lane.queueDate.toISOString().slice(0, 10)}:${lane.prefix}`;
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
		const { _max } = await tx.queueTicket.aggregate({ where: lane, _max: { number: true } });
		return (_max.number ?? 0) + 1;
	}

	create(tx: ClinicalTx, data: Prisma.QueueTicketUncheckedCreateInput): Promise<QueueTicketRow> {
		return tx.queueTicket.create({ data, include: TICKET_INCLUDE });
	}

	findById(tx: ClinicalTx, id: string): Promise<QueueTicketRow | null> {
		return tx.queueTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
	}

	/** The open ticket of a visit, if any. */
	findOpenByEncounter(tx: ClinicalTx, encounterId: string): Promise<QueueTicketRow | null> {
		return tx.queueTicket.findFirst({
			where: { encounterId, status: { notIn: ['DONE', 'CANCELLED'] } },
			include: TICKET_INCLUDE,
		});
	}

	/** A day's tickets at the clinic (optionally one station, one doctor's line, some statuses), by number. */
	listForDay(
		tx: ClinicalTx,
		query: {
			clinicId: string;
			queueDate: Date;
			station?: string | null;
			practitionerId?: string | null;
			statuses?: readonly QueueStatus[] | null;
		},
	): Promise<QueueTicketRow[]> {
		return tx.queueTicket.findMany({
			where: {
				clinicId: query.clinicId,
				queueDate: query.queueDate,
				...(query.station && { station: query.station }),
				...(query.practitionerId && { practitionerId: query.practitionerId }),
				...(query.statuses?.length && { status: { in: [...query.statuses] } }),
			},
			include: TICKET_INCLUDE,
			orderBy: [{ isPriority: 'desc' }, { issuedAt: 'asc' }, { number: 'asc' }],
		});
	}

	/** The board's view of a day: numbers, lanes, stations and doctors only, never the patient. */
	listForBoard(tx: ClinicalTx, clinicId: string, queueDate: Date) {
		return tx.queueTicket.findMany({
			where: { clinicId, queueDate, status: { in: ['WAITING', 'CALLED', 'SERVING'] } },
			select: {
				id: true,
				prefix: true,
				number: true,
				isPriority: true,
				station: true,
				status: true,
				issuedAt: true,
				calledAt: true,
				practitioner: { select: APPOINTMENT_INCLUDE.practitioner.select },
			},
			orderBy: [{ isPriority: 'desc' }, { issuedAt: 'asc' }, { number: 'asc' }],
		});
	}

	/**
	 * Updates the ticket only while its status is still `from` (one statement), so two desks calling the same patient
	 * don't both win; null when it moved on.
	 */
	async update(
		tx: ClinicalTx,
		id: string,
		from: QueueStatus,
		data: Prisma.QueueTicketUncheckedUpdateManyInput,
	): Promise<QueueTicketRow | null> {
		const { count } = await tx.queueTicket.updateMany({ where: { id, status: from }, data });
		return count === 0 ? null : tx.queueTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
	}
}

/** The ticket's own columns, for an audit snapshot (no joined names). */
export function ticketColumns(row: QueueTicketRow) {
	return {
		id: row.id,
		clinicId: row.clinicId,
		queueDate: row.queueDate,
		prefix: row.prefix,
		number: row.number,
		isPriority: row.isPriority,
		priorityReason: row.priorityReason,
		practitionerId: row.practitionerId,
		encounterId: row.encounterId,
		station: row.station,
		status: row.status,
	};
}

export type BoardTicketRow = Awaited<ReturnType<QueueRepository['listForBoard']>>[number];
