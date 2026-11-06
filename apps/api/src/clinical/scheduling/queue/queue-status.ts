import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { PriorityReason, QueueStatus } from '../../../generated/prisma/enums.js';
import type { QueueStation } from '../scheduling.enums.js';

/**
 * A queue ticket's status machine (`queue_status`). One ticket follows the patient through the day's stations
 * (triage → the doctor's room → the cashier) and keeps its number:
 *
 * ```
 * WAITING ──► CALLED ──► SERVING ──► DONE
 *    ▲          │           │
 *    │          ▼           └──► WAITING at the next station (transfer)
 *    └────── SKIPPED (not there when called; requeued when they come back)
 * any but DONE ──► CANCELLED (left before being seen)
 * ```
 *
 * Statuses are only written through the functions below; each returns the columns to set.
 */
export const QUEUE_TRANSITIONS: Readonly<Record<QueueStatus, readonly QueueStatus[]>> = {
	WAITING: ['CALLED', 'CANCELLED'],
	CALLED: ['SERVING', 'SKIPPED', 'CANCELLED'],
	SERVING: ['DONE', 'WAITING', 'CANCELLED'],
	SKIPPED: ['WAITING', 'CANCELLED'],
	DONE: [],
	CANCELLED: [],
};

/** Tickets still in the clinic's lines. */
export const OPEN_QUEUE_STATUSES: readonly QueueStatus[] = ['WAITING', 'CALLED', 'SERVING', 'SKIPPED'];

export interface QueueTicketChange {
	status: QueueStatus;
	station?: QueueStation;
	calledAt?: Date | null;
	servedAt?: Date | null;
	doneAt?: Date | null;
}

function guard(from: QueueStatus, to: QueueStatus): void {
	if (!QUEUE_TRANSITIONS[from].includes(to)) {
		throw new InvalidStatusTransitionError('QueueTicket', from, to);
	}
}

/** WAITING → CALLED: the patient's number is on the board. */
export function callTicket(from: QueueStatus, now: Date = new Date()): QueueTicketChange {
	guard(from, 'CALLED');
	return { status: 'CALLED', calledAt: now };
}

/** CALLED → SERVING: the patient is at the station. */
export function serveTicket(from: QueueStatus, now: Date = new Date()): QueueTicketChange {
	guard(from, 'SERVING');
	return { status: 'SERVING', servedAt: now };
}

/** SERVING → WAITING at the next station (triage → the doctor, the doctor → the cashier). */
export function transferTicket(from: QueueStatus, station: QueueStation): QueueTicketChange {
	guard(from, 'WAITING');
	if (from !== 'SERVING') {
		throw new InvalidStatusTransitionError('QueueTicket', from, 'WAITING');
	}
	return { status: 'WAITING', station, calledAt: null, servedAt: null };
}

/** SERVING → DONE: the patient leaves the clinic's lines. */
export function finishTicket(from: QueueStatus, now: Date = new Date()): QueueTicketChange {
	guard(from, 'DONE');
	return { status: 'DONE', doneAt: now };
}

/** CALLED → SKIPPED: not there when called. */
export function skipTicket(from: QueueStatus): QueueTicketChange {
	guard(from, 'SKIPPED');
	return { status: 'SKIPPED' };
}

/** SKIPPED → WAITING: back in line at the same station, keeping the number. */
export function requeueTicket(from: QueueStatus): QueueTicketChange {
	guard(from, 'WAITING');
	if (from !== 'SKIPPED') {
		throw new InvalidStatusTransitionError('QueueTicket', from, 'WAITING');
	}
	return { status: 'WAITING', calledAt: null };
}

/** Any open status → CANCELLED: the patient left. */
export function cancelTicket(from: QueueStatus, now: Date = new Date()): QueueTicketChange {
	guard(from, 'CANCELLED');
	return { status: 'CANCELLED', doneAt: now };
}

/** The lane of a ticket: "P" for the priority lane (RA 9994, RA 7277 / RA 10754), else "A". */
export function laneOf(priorityReason: PriorityReason | null | undefined): { prefix: 'A' | 'P'; isPriority: boolean } {
	return priorityReason ? { prefix: 'P', isPriority: true } : { prefix: 'A', isPriority: false };
}

/** The order patients are called at a station: the priority lane first, then by number (arrival). */
export function byCallOrder<T extends { isPriority: boolean; number: number; issuedAt: Date }>(tickets: T[]): T[] {
	return [...tickets].sort(
		(a, b) =>
			Number(b.isPriority) - Number(a.isPriority) ||
			a.issuedAt.getTime() - b.issuedAt.getTime() ||
			a.number - b.number,
	);
}

/** "A-007", "P-002". */
export function ticketCode(ticket: { prefix: string; number: number }): string {
	return `${ticket.prefix}-${String(ticket.number).padStart(3, '0')}`;
}

/** A visit's status, as the queue follows it. */
type VisitStatus = 'OPEN' | 'IN_PROGRESS' | 'FOR_BILLING' | 'COMPLETED' | 'CANCELLED';

/** The steps taken so far and where they leave the ticket. */
interface Walk {
	status: QueueStatus;
	station: QueueStation;
	steps: QueueTicketChange[];
}

function walk(from: Walk, change: QueueTicketChange): Walk {
	return {
		status: change.status,
		station: change.station ?? from.station,
		steps: [...from.steps, change],
	};
}

/** At the ticket's station, on to SERVING: a skipped patient back in line, called, at the desk. */
function toServing(from: Walk, now: Date): Walk {
	let state = from;
	if (state.status === 'SKIPPED') {
		state = walk(state, requeueTicket(state.status));
	}
	if (state.status === 'WAITING') {
		state = walk(state, callTicket(state.status, now));
	}
	if (state.status === 'CALLED') {
		state = walk(state, serveTicket(state.status, now));
	}
	return state;
}

/**
 * Where a visit's status puts its ticket when the visit moved outside the queue pages (the encounter page): with the
 * doctor (IN_PROGRESS) the ticket is SERVING at the doctor's room; for billing it WAITS at the cashier; a completed
 * visit's ticket is DONE and a cancelled one's CANCELLED. OPEN moves nothing.
 *
 * Returns the one change that walks the ticket there through the status machine (every step guarded by the functions
 * above, their columns merged), or null when the ticket is there already or closed.
 */
export function followVisit(
	ticket: { status: QueueStatus; station: string | null },
	visit: VisitStatus,
	now: Date = new Date(),
): QueueTicketChange | null {
	if (ticket.status === 'DONE' || ticket.status === 'CANCELLED') {
		return null;
	}
	const start: Walk = { status: ticket.status, station: (ticket.station ?? 'TRIAGE') as QueueStation, steps: [] };
	let state: Walk;
	switch (visit) {
		case 'OPEN':
			return null;
		case 'IN_PROGRESS':
			if (start.station === 'DOCTOR' && start.status === 'SERVING') {
				return null;
			}
			state = start.station === 'DOCTOR' ? start : toServing(start, now);
			if (state.station !== 'DOCTOR') {
				state = walk(state, transferTicket(state.status, 'DOCTOR'));
			}
			state = toServing(state, now);
			break;
		case 'FOR_BILLING':
			if (start.station === 'CASHIER') {
				return null;
			}
			state = toServing(start, now);
			state = walk(state, transferTicket(state.status, 'CASHIER'));
			break;
		case 'COMPLETED':
			state = toServing(start, now);
			state = walk(state, finishTicket(state.status, now));
			break;
		case 'CANCELLED':
			state = walk(start, cancelTicket(start.status, now));
			break;
	}
	return state.steps.reduce<QueueTicketChange>((merged, change) => ({ ...merged, ...change }), {
		status: state.status,
	});
}
