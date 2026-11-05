import { canTransitionEncounter, ENCOUNTER_STATUS_TRANSITIONS } from '@loopwise/shared/encounter';

import { InvalidStatusTransitionError } from '../../common/errors/domain-error.js';
import type { EncounterStatus } from '../../generated/prisma/enums.js';

/**
 * The visit's status machine (`encounter_status`), shared with the encounter page (`ENCOUNTER_STATUS_TRANSITIONS` of
 * `@loopwise/shared/encounter`):
 *
 * ```
 * OPEN ──► IN_PROGRESS ──► FOR_BILLING ──► COMPLETED
 *   │          │  ▲            │
 *   │          │  └────────────┤ (reopened by the doctor before payment)
 *   │          └───────────────┼──► COMPLETED (nothing to bill)
 *   └──────────┴───────────────┴──► CANCELLED
 * ```
 *
 * COMPLETED and CANCELLED are final. Statuses are only written through `transitionEncounterStatus`.
 */
export const ENCOUNTER_TRANSITIONS = ENCOUNTER_STATUS_TRANSITIONS;

/** The columns a move sets besides `status`: a visit that ends gets its `endedAt`. */
export interface EncounterStatusChange {
	status: EncounterStatus;
	endedAt?: Date;
}

/**
 * The change for moving a visit from `from` to `to`, or INVALID_STATUS_TRANSITION when the machine forbids it
 * (including staying put).
 */
export function transitionEncounterStatus(
	from: EncounterStatus,
	to: EncounterStatus,
	now: Date = new Date(),
): EncounterStatusChange {
	if (!canTransitionEncounter(from, to)) {
		throw new InvalidStatusTransitionError('Encounter', from, to);
	}
	return to === 'COMPLETED' || to === 'CANCELLED' ? { status: to, endedAt: now } : { status: to };
}

/** The statuses a visit may be created with: checked in at the front desk, or straight in with the doctor. */
export const INITIAL_ENCOUNTER_STATUSES: readonly EncounterStatus[] = ['OPEN', 'IN_PROGRESS'];
