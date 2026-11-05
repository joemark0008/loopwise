import { InvalidInputError } from './patients.errors.js';

/** A zod schema of `@loopwise/shared` (v3), as far as parsing goes. */
export interface SharedSchema<T> {
	safeParse(
		values: unknown,
	): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

/**
 * Parses `values` with a shared rule set (the same the forms and Wise cards use), or throws INVALID_INPUT with every
 * message (or the error `toError` builds).
 */
export function parseInput<T>(
	schema: SharedSchema<T>,
	values: unknown,
	toError: (message: string) => Error = (message) => new InvalidInputError(message),
): T {
	const parsed = schema.safeParse(values);
	if (!parsed.success) {
		throw toError(parsed.error.issues.map((issue) => issue.message).join(' '));
	}
	return parsed.data;
}

/** `YYYY-MM-DD` → a Date for a `@db.Date` column. */
export function dateOnly(value: string): Date {
	return new Date(`${value}T00:00:00Z`);
}

/** A `@db.Date` value → `YYYY-MM-DD`. */
export function toDateOnly(value: Date): string;
export function toDateOnly(value: Date | null): string | null;
export function toDateOnly(value: Date | null): string | null {
	return value ? value.toISOString().slice(0, 10) : null;
}
