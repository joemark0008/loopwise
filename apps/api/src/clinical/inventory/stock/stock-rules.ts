/**
 * The pure rules of the stock ledger (DESIGN.md §5.5): Manila calendar days, expiry, first-expiry-first-out picking and
 * the dashboard's alerts. No database here, so they are unit-tested (`stock-rules.spec.ts`).
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Days before expiry a lot shows as expiring on the dashboard. */
export const EXPIRING_WITHIN_DAYS = 90;

/** `YYYY-MM-DD` of an instant in Manila (stock expires on Philippine calendar days). */
export function manilaToday(at: Date = new Date()): string {
	return new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whether `value` is a real `YYYY-MM-DD` calendar date. */
export function isCalendarDate(value: string): boolean {
	return DATE_RE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** The date `days` after `date`. */
export function addDays(date: string, days: number): string {
	return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` of a `@db.Date` value (stored as UTC midnight). */
export function dateOnly(value: Date | null): string | null {
	return value ? value.toISOString().slice(0, 10) : null;
}

/** A lot is expired from its expiry date on (it is not dispensed on the day it expires). */
export function isExpired(expiryDate: string | null, today: string): boolean {
	return expiryDate !== null && expiryDate <= today;
}

/** Days from `today` to the expiry date (negative once past). */
export function daysUntil(expiryDate: string, today: string): number {
	return Math.round((Date.parse(`${expiryDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** A lot as the picking rules see it. */
export interface PickableLot {
	id: string;
	lotNo: string;
	expiryDate: string | null;
	quantityOnHand: number;
	receivedAt: Date;
}

/** One lot and how much to take from it. */
export interface LotPick {
	lotId: string;
	lotNo: string;
	quantity: number;
}

/**
 * The lots to take `quantity` from, first expiry first out: unexpired lots with stock, earliest expiry first (lots
 * without an expiry date last), then the oldest delivery. Null when the unexpired stock is short.
 */
export function pickFefo(lots: readonly PickableLot[], quantity: number, today: string): LotPick[] | null {
	const usable = fefoOrder(lots, today);
	const picks: LotPick[] = [];
	let left = quantity;
	for (const lot of usable) {
		if (left <= 0) {
			break;
		}
		const take = Math.min(lot.quantityOnHand, left);
		picks.push({ lotId: lot.id, lotNo: lot.lotNo, quantity: take });
		left = round2(left - take);
	}
	return left > 0 ? null : picks;
}

/** The unexpired lots with stock, in the order FEFO takes them. */
export function fefoOrder<T extends PickableLot>(lots: readonly T[], today: string): T[] {
	return lots
		.filter((lot) => lot.quantityOnHand > 0 && !isExpired(lot.expiryDate, today))
		.sort(
			(a, b) =>
				(a.expiryDate ?? '9999-12-31').localeCompare(b.expiryDate ?? '9999-12-31') ||
				a.receivedAt.getTime() - b.receivedAt.getTime(),
		);
}

/** Unexpired stock on hand. */
export function usableQuantity(lots: readonly PickableLot[], today: string): number {
	return round2(
		lots.filter((lot) => !isExpired(lot.expiryDate, today)).reduce((sum, lot) => sum + lot.quantityOnHand, 0),
	);
}

/** The state of one lot on the dashboard. */
export type LotAlert = 'EXPIRED' | 'EXPIRING' | null;

/** EXPIRED once past, EXPIRING within `withinDays`, else null; lots without stock or expiry never alert. */
export function lotAlert(
	lot: Pick<PickableLot, 'expiryDate' | 'quantityOnHand'>,
	today: string,
	withinDays = EXPIRING_WITHIN_DAYS,
): LotAlert {
	if (lot.quantityOnHand <= 0 || !lot.expiryDate) {
		return null;
	}
	if (isExpired(lot.expiryDate, today)) {
		return 'EXPIRED';
	}
	return daysUntil(lot.expiryDate, today) <= withinDays ? 'EXPIRING' : null;
}

/** Low stock: unexpired stock at or below the item's reorder level (items without one never alert). */
export function isLowStock(usable: number, reorderLevel: number | null): boolean {
	return reorderLevel !== null && usable <= reorderLevel;
}

/** Quantities are `DECIMAL(12,2)`: keep sums on two decimals. */
export function round2(value: number): number {
	return Math.round(value * 100) / 100;
}
