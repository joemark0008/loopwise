import { staleEditMessage } from '@loopwise/shared/wise-proposal';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { Encounter, Prisma } from '../../generated/prisma/client.js';
import type { EncounterRepository } from './encounter.repository.js';

/**
 * The encounter a user is adding to, read as the user: not found when row-level security hides it, forbidden unless
 * the user works at its facility (record rows carry the encounter's facility, which RLS also checks on write).
 */
export async function encounterForWrite(
	tx: Prisma.TransactionClient,
	encounters: EncounterRepository,
	facilityIds: readonly string[],
	encounterId: string,
): Promise<Encounter> {
	const encounter = await encounters.findById(tx, encounterId);
	if (!encounter) {
		throw new HandlerError('NOT_FOUND', 'Encounter not found.');
	}
	if (!facilityIds.includes(encounter.orgId)) {
		throw new HandlerError('FORBIDDEN', 'Only staff at the facility of the visit can add to its record.');
	}
	return encounter;
}

/** Parses `values` with a shared zod schema, or throws BAD_REQUEST with every message. */
export function parseOrThrow<T>(
	schema: {
		safeParse(
			values: unknown,
		): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
	},
	values: unknown,
): T {
	const parsed = schema.safeParse(values);
	if (!parsed.success) {
		throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join(' '));
	}
	return parsed.data;
}

/** `YYYY-MM-DD` → a Date for a `@db.Date` column. */
export function dateOnly(value: string): Date {
	return new Date(`${value}T00:00:00Z`);
}

/**
 * Refuses a save made from a stale draft (DESIGN.md §9.1). The version trigger moves the saved row from
 * `expectedVersion` to `expectedVersion + 1`; anything else means someone changed it since the draft was made, and
 * throwing rolls the transaction back.
 */
export function assertSavedFromVersion(
	row: { version: number },
	expectedVersion: number | null | undefined,
	record: string,
): void {
	if (expectedVersion != null && row.version !== expectedVersion + 1) {
		throw new HandlerError('CONFLICT', staleEditMessage(record));
	}
}
