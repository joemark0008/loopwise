/** Normalizers for form input, shared by the settings services. */

/** A trimmed string, or null when empty or missing. */
export function text(value: string | null | undefined): string | null {
	return value?.trim() || null;
}

/** A `date` column value from `YYYY-MM-DD` (null when empty). */
export function dateColumn(value: string | null | undefined): Date | null {
	return value ? new Date(`${value}T00:00:00Z`) : null;
}

/** `YYYY-MM-DD` of a `date` column value. */
export function dateOnly(value: Date | null | undefined): string | null {
	return value?.toISOString().slice(0, 10) ?? null;
}
