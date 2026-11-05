/**
 * A practitioner's day at a clinic, worked out from the weekly schedule (`practitioner_schedules`) and their leaves
 * (`practitioner_leaves`). Pure: no database, no clock. Clinic hours are local times in the Philippines (UTC+8, no
 * daylight saving), so a session on 2026-11-10 from 09:00 to 12:00 is 01:00–04:00 UTC.
 */

/** The Philippines' UTC offset (Asia/Manila has no daylight saving). */
export const MANILA_OFFSET = '+08:00';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTE_MS = 60_000;

/** One weekly session of `practitioner_schedules` (times as `HH:MM`, local). */
export interface WeeklySession {
	id: string;
	/** 0 = Sunday … 6 = Saturday. */
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	slotMinutes: number;
	/** Cap per session ("first come, first served" clinics); null = no cap. */
	maxPatients: number | null;
}

/** A leave (`practitioner_leaves`): the practitioner is out from `startAt` until `endAt`. */
export interface LeaveWindow {
	id: string;
	startAt: Date;
	endAt: Date;
	reason: string | null;
}

/** A bookable slot. */
export interface Slot {
	startsAt: Date;
	endsAt: Date;
}

/** A weekly session on a given date, with the slots a leave leaves free. */
export interface DaySession extends WeeklySession {
	startsAt: Date;
	endsAt: Date;
	/** A leave overlaps the session (some or all of its slots are gone). */
	onLeave: boolean;
	slots: Slot[];
}

export function isDateOnly(value: string): boolean {
	if (!DATE_ONLY.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTimeOfDay(value: string): boolean {
	return TIME_OF_DAY.test(value);
}

/** Minutes since midnight of an `HH:MM` time. */
export function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

/** The day of week (0 = Sunday) of a calendar date `YYYY-MM-DD`. */
export function dayOfWeekOf(date: string): number {
	return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The instant of a local Philippine date and time (`2026-11-10`, `09:00`). */
export function manilaInstant(date: string, time: string): Date {
	return new Date(`${date}T${time}:00${MANILA_OFFSET}`);
}

/** The local day as an instant range: [00:00, next 00:00) in the Philippines. */
export function manilaDayRange(date: string): { from: Date; to: Date } {
	const from = manilaInstant(date, '00:00');
	return { from, to: new Date(from.getTime() + 24 * 60 * MINUTE_MS) };
}

/** The calendar date `YYYY-MM-DD` in the Philippines of an instant. */
export function manilaDateOf(instant: Date): string {
	return new Date(instant.getTime() + 8 * 60 * MINUTE_MS).toISOString().slice(0, 10);
}

/** Whether `[from, to)` overlaps the leave. An instant (`to` = `from`) is on leave when `startAt <= from < endAt`. */
export function overlapsLeave(leave: Pick<LeaveWindow, 'startAt' | 'endAt'>, from: Date, to: Date = from): boolean {
	if (to.getTime() === from.getTime()) {
		return leave.startAt.getTime() <= from.getTime() && from.getTime() < leave.endAt.getTime();
	}
	return leave.startAt.getTime() < to.getTime() && leave.endAt.getTime() > from.getTime();
}

/**
 * The sessions of `date` (those of its day of week, by start time), each cut into slots of `slotMinutes` that end
 * inside the session; slots that overlap a leave are left out.
 */
export function sessionsOn(
	date: string,
	weekly: readonly WeeklySession[],
	leaves: readonly LeaveWindow[],
): DaySession[] {
	const dayOfWeek = dayOfWeekOf(date);
	return weekly
		.filter((session) => session.dayOfWeek === dayOfWeek)
		.sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
		.map((session) => {
			const startsAt = manilaInstant(date, session.startTime);
			const endsAt = manilaInstant(date, session.endTime);
			const slots: Slot[] = [];
			const step = Math.max(1, session.slotMinutes) * MINUTE_MS;
			for (let start = startsAt.getTime(); start + step <= endsAt.getTime(); start += step) {
				const slot = { startsAt: new Date(start), endsAt: new Date(start + step) };
				if (!leaves.some((leave) => overlapsLeave(leave, slot.startsAt, slot.endsAt))) {
					slots.push(slot);
				}
			}
			return {
				...session,
				startsAt,
				endsAt,
				onLeave: leaves.some((leave) => overlapsLeave(leave, startsAt, endsAt)),
				slots,
			};
		});
}

/** Two `HH:MM` ranges on the same day overlap (touching ends do not). */
export function timesOverlap(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }) {
	return minutesOf(a.startTime) < minutesOf(b.endTime) && minutesOf(b.startTime) < minutesOf(a.endTime);
}
