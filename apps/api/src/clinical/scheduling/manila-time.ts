/**
 * Calendar dates and clinic hours in the Philippines (UTC+8, no daylight saving): queue days, schedule sessions and
 * "tomorrow" for reminders are Manila days whatever the server's time zone.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` of an instant in Manila. */
export function manilaDate(at: Date = new Date()): string {
	return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whether `value` is a real `YYYY-MM-DD` calendar date. */
export function isCalendarDate(value: string): boolean {
	return DATE_RE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** The instant a Manila calendar day starts. */
export function manilaDayStart(date: string): Date {
	return new Date(`${date}T00:00:00+08:00`);
}

/** `[start, end)` of `days` Manila days from `date`. */
export function manilaRange(date: string, days = 1): { start: Date; end: Date } {
	const start = manilaDayStart(date);
	return { start, end: new Date(start.getTime() + days * DAY_MS) };
}

/** The date `days` after `date`. */
export function addDays(date: string, days: number): string {
	return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday (the reference's `day_of_week`). */
export function weekday(date: string): number {
	return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** A `date` column value (midnight UTC of the calendar date, as Prisma reads and writes `@db.Date`). */
export function dateColumn(date: string): Date {
	return new Date(`${date}T00:00:00Z`);
}

/**
 * The instant of a clinic time on a Manila date. `time` is a `time` column as Prisma returns it (1970-01-01 at that
 * time, UTC) or `HH:MM`.
 */
export function manilaAt(date: string, time: Date | string): Date {
	const hhmm = typeof time === 'string' ? time : time.toISOString().slice(11, 16);
	return new Date(`${date}T${hhmm}:00+08:00`);
}

/** `HH:MM` of an instant in Manila. */
export function manilaClock(at: Date): string {
	return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}
