/**
 * Shared rules of Wise proposal cards (DESIGN.md §9.1), for the API and the cards.
 */

/** The CONFLICT message of a stale edit: the record changed after the draft was made. Cards offer to re-draft on it. */
export const staleEditMessage = (record: string) =>
	`This ${record} was changed after this edit was drafted. Ask Wise to re-draft it from the current ${record}.`;

export const isStaleEditMessage = (message: string) => message.includes('was changed after this edit was drafted');

/** The shortest reason a destructive card (void, remove) accepts. */
export const DESTRUCTIVE_REASON_MIN_LENGTH = 5;
