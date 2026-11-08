import type { AppointmentStatus, QueueStatus } from '@/graphql/generated/graphql';

/** A wait past this many minutes is shown in the warning colour. */
export const LONG_WAIT_MIN = 30;

/** Whole minutes since `since` (never negative). */
export const minutesSince = (since: string, now: Date = new Date()) =>
	Math.max(0, Math.round((now.getTime() - new Date(since).getTime()) / 60_000));

interface TicketPoint {
	status: QueueStatus;
	issuedAt: string;
}

export interface QueueSummary {
	waiting: number;
	/** Called to a desk or being seen there. */
	atDesk: number;
	notHere: number;
	done: number;
	/** Minutes the longest-waiting ticket has waited; null when nobody waits. */
	longestWait: number | null;
}

/** The front desk's numbers for the day, from the day's tickets. */
export function queueSummary(tickets: readonly TicketPoint[], now: Date = new Date()): QueueSummary {
	const waiting = tickets.filter((ticket) => ticket.status === 'WAITING');
	return {
		waiting: waiting.length,
		atDesk: tickets.filter((ticket) => ticket.status === 'CALLED' || ticket.status === 'SERVING').length,
		notHere: tickets.filter((ticket) => ticket.status === 'SKIPPED').length,
		done: tickets.filter((ticket) => ticket.status === 'DONE').length,
		longestWait: waiting.length ? Math.max(...waiting.map((ticket) => minutesSince(ticket.issuedAt, now))) : null,
	};
}

export interface AppointmentSummary {
	/** Booked or confirmed, not here yet. */
	toCome: number;
	/** Checked in or with the doctor. */
	here: number;
	seen: number;
	noShow: number;
}

/** The bookings of a day (or week) by where they stand. Cancelled and moved bookings are left out. */
export function appointmentSummary(appointments: readonly { status: AppointmentStatus }[]): AppointmentSummary {
	const count = (...statuses: AppointmentStatus[]) =>
		appointments.filter((appointment) => statuses.includes(appointment.status)).length;
	return {
		toCome: count('SCHEDULED', 'CONFIRMED'),
		here: count('ARRIVED', 'IN_PROGRESS'),
		seen: count('COMPLETED'),
		noShow: count('NO_SHOW'),
	};
}

/** Index of the first booking at or after `now` in a list sorted by start; the list's length when all are past. */
export function nowIndex(starts: readonly string[], now: Date = new Date()): number {
	const index = starts.findIndex((start) => new Date(start).getTime() >= now.getTime());
	return index === -1 ? starts.length : index;
}
