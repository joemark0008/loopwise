import { addDays } from '../scheduling/manila-time.js';

/** Where a follow-up date stands against today (Asia/Manila). */
export type FollowUpTiming = 'OVERDUE' | 'DUE' | 'UPCOMING';

/** The days ahead a list covers by default ("this week") and at most. */
export const DEFAULT_WITHIN_DAYS = 7;
export const MAX_WITHIN_DAYS = 60;
/** How far back an overdue follow-up still shows by default, and at most. */
export const DEFAULT_OVERDUE_DAYS = 180;
export const MAX_OVERDUE_DAYS = 730;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The follow-up dates a list covers: from `overdueDays` before today (Manila) to `withinDays` after it, both
 * included. Out-of-range values are clamped.
 */
export function followUpWindow(
	today: string,
	opts: { withinDays?: number | null; overdueDays?: number | null } = {},
): { from: string; to: string } {
	const within = clamp(opts.withinDays ?? DEFAULT_WITHIN_DAYS, 0, MAX_WITHIN_DAYS);
	const overdue = clamp(opts.overdueDays ?? DEFAULT_OVERDUE_DAYS, 0, MAX_OVERDUE_DAYS);
	return { from: addDays(today, -overdue), to: addDays(today, within) };
}

/** Days from today to the follow-up date (negative: overdue by that many days) and what that makes it. */
export function followUpTiming(followUpDate: string, today: string): { timing: FollowUpTiming; daysFromToday: number } {
	const days = Math.round(
		(new Date(`${followUpDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS,
	);
	return { timing: days < 0 ? 'OVERDUE' : days === 0 ? 'DUE' : 'UPCOMING', daysFromToday: days };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.trunc(value)));
}
