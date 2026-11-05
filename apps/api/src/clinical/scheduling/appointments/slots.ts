import type { ScheduleSession } from '../availability/practitioner-availability.js';
import { SlotStatus } from '../scheduling.enums.js';

/** A bookable time of a session. */
export interface SlotDraft {
	start: Date;
	end: Date;
	status: SlotStatus;
}

const MINUTE = 60_000;

/**
 * The slots of a doctor's sessions on a day: every `slotMinutes` from the session's start while a whole slot fits.
 * A slot is BOOKED when an active booking starts inside it, every free slot of a session is FULL once the session holds
 * `maxPatients` bookings, and a slot that already started is PAST. Leaves are applied by the caller (`ON_LEAVE`).
 */
export function buildSlots(
	sessions: readonly ScheduleSession[],
	bookings: readonly { start: Date }[],
	now: Date = new Date(),
): SlotDraft[] {
	const slots: SlotDraft[] = [];
	for (const session of sessions) {
		const step = Math.max(5, session.slotMinutes) * MINUTE;
		const inSession = bookings.filter(
			(booking) => booking.start >= session.start && booking.start < session.end,
		).length;
		const full = session.maxPatients !== null && inSession >= session.maxPatients;
		for (let at = session.start.getTime(); at + step <= session.end.getTime(); at += step) {
			const start = new Date(at);
			const end = new Date(at + step);
			const booked = bookings.some((booking) => booking.start >= start && booking.start < end);
			const status = booked
				? SlotStatus.BOOKED
				: start < now
					? SlotStatus.PAST
					: full
						? SlotStatus.FULL
						: SlotStatus.OPEN;
			slots.push({ start, end, status });
		}
	}
	return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
