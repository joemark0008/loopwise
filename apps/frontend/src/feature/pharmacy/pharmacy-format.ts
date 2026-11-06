import type { ItemCategory, StockMovementType, TaxType } from '@/graphql/generated/graphql';

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
	MEDICINE: 'Medicine',
	VACCINE: 'Vaccine',
	MEDICAL_SUPPLY: 'Medical supply',
	LAB_REAGENT: 'Lab reagent',
	DENTAL_SUPPLY: 'Dental supply',
	OFFICE_SUPPLY: 'Office supply',
	OTHER: 'Other',
};

export const TAX_LABELS: Record<TaxType, string> = {
	VAT_EXEMPT: 'VAT-exempt',
	VATABLE: 'VATable (12% included)',
	ZERO_RATED: 'Zero-rated',
};

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
	RECEIPT: 'Received',
	DISPENSE: 'Dispensed',
	CONSUMPTION: 'Used on a visit',
	ADJUSTMENT_IN: 'Adjusted in',
	ADJUSTMENT_OUT: 'Adjusted out',
	TRANSFER_IN: 'Transfer in',
	TRANSFER_OUT: 'Transfer out',
	RETURN_TO_SUPPLIER: 'Returned to supplier',
	RETURN_FROM_PATIENT: 'Returned by patient',
	EXPIRED_DISPOSAL: 'Expired, disposed',
	DAMAGED: 'Damaged',
};

const QUANTITY = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });
const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

/** "1,250" or "2.5". */
export const qty = (value: number): string => QUANTITY.format(value);

/** A signed ledger quantity: "+200", "−21". */
export const signedQty = (value: number): string => (value > 0 ? `+${qty(value)}` : `−${qty(Math.abs(value))}`);

export const peso = (value: number | null | undefined): string => (value == null ? '—' : PESO.format(value));

/** "Jan 12, 2027" of a `YYYY-MM-DD` date (no time zone shift). */
export function formatDate(date: string | null | undefined): string {
	if (!date) {
		return '—';
	}
	return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	});
}

/** "in 40 days", "today", "20 days ago". */
export function expiresIn(days: number | null | undefined): string {
	if (days == null) {
		return 'No expiry';
	}
	if (days === 0) {
		return 'Expires today';
	}
	return days > 0
		? `Expires in ${days} day${days === 1 ? '' : 's'}`
		: `Expired ${-days} day${days === -1 ? '' : 's'} ago`;
}

/** A form's number, or null when empty or not a number. */
export function numberOrNull(value: string): number | null {
	if (!value.trim()) {
		return null;
	}
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

/** A form's text, trimmed, or null when empty. */
export const orNull = (value: string): string | null => value.trim() || null;

/** Today in Manila as `YYYY-MM-DD` (expiry dates are Philippine calendar days). */
export function manilaToday(now: Date = new Date()): string {
	return new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
