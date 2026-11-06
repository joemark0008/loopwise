const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** The calendar date in Manila (UTC+8, no DST) of an instant, as YYYY-MM-DD. */
export function manilaDate(at: Date = new Date()): string {
	return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instants a range of Manila dates covers: [from 00:00, the day after `to` 00:00). */
export function manilaDayRange(from: string, to: string = from): { gte: Date; lt: Date } {
	const start = new Date(`${from}T00:00:00+08:00`);
	const end = new Date(`${to}T00:00:00+08:00`);
	end.setUTCDate(end.getUTCDate() + 1);
	return { gte: start, lt: end };
}

/** A YYYY-MM-DD date stored in a `date` column (midnight UTC). */
export const dateOnly = (value: string) => new Date(`${value}T00:00:00Z`);
