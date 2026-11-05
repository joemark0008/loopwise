import { InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { DiagnosticOrderStatus } from '../../../generated/prisma/enums.js';

/**
 * The diagnostic order status machine, the TypeScript mirror of the `check_diagnostic_order_transition` trigger
 * (migration 0001_rls_and_triggers), which guards both `diagnostic_orders` and `diagnostic_order_items`; keep both in
 * step. Payment may come before extraction (PAID, many PH clinics collect first); a released result that needs
 * correcting goes back to IN_PROGRESS.
 */
export const DIAGNOSTIC_ORDER_TRANSITIONS: Readonly<Record<DiagnosticOrderStatus, readonly DiagnosticOrderStatus[]>> = {
	REQUESTED: ['PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'CANCELLED'],
	PAID: ['SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'CANCELLED'],
	SPECIMEN_COLLECTED: ['IN_PROGRESS', 'RESULTED', 'CANCELLED'],
	IN_PROGRESS: ['RESULTED', 'CANCELLED'],
	RESULTED: ['RELEASED', 'IN_PROGRESS'],
	RELEASED: ['IN_PROGRESS'],
	CANCELLED: [],
};

/** How far along a test is; the order's header is as far as its least advanced test that still runs. */
export const DIAGNOSTIC_STATUS_RANK: Readonly<Record<DiagnosticOrderStatus, number>> = {
	REQUESTED: 0,
	PAID: 1,
	SPECIMEN_COLLECTED: 2,
	IN_PROGRESS: 3,
	RESULTED: 4,
	RELEASED: 5,
	CANCELLED: 6,
};

/** The statuses whose test can still be cancelled (no result yet). */
export const CANCELLABLE_STATUSES: readonly DiagnosticOrderStatus[] = Object.entries(DIAGNOSTIC_ORDER_TRANSITIONS)
	.filter(([, next]) => next.includes('CANCELLED'))
	.map(([status]) => status as DiagnosticOrderStatus);

export function canTransition(from: DiagnosticOrderStatus, to: DiagnosticOrderStatus): boolean {
	return DIAGNOSTIC_ORDER_TRANSITIONS[from].includes(to);
}

/** Refuses a move the trigger would refuse, with the domain error (CONFLICT, `INVALID_STATUS_TRANSITION`). */
export function assertTransition(
	entityType: 'DiagnosticOrder' | 'DiagnosticOrderItem',
	from: DiagnosticOrderStatus,
	to: DiagnosticOrderStatus,
): void {
	if (!canTransition(from, to)) {
		throw new InvalidStatusTransitionError(entityType, from, to);
	}
}

/**
 * The shortest chain of allowed moves from `from` to `to` (excluding `from`): `[]` when they are equal, null when
 * `to` can't be reached. The order header uses it to follow its tests, which may jump further in one step than the
 * header may (one test released while another is cancelled).
 */
export function transitionPath(from: DiagnosticOrderStatus, to: DiagnosticOrderStatus): DiagnosticOrderStatus[] | null {
	if (from === to) {
		return [];
	}
	const previous = new Map<DiagnosticOrderStatus, DiagnosticOrderStatus>();
	const queue: DiagnosticOrderStatus[] = [from];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const next of DIAGNOSTIC_ORDER_TRANSITIONS[current]) {
			if (next === from || previous.has(next)) {
				continue;
			}
			previous.set(next, current);
			if (next === to) {
				const path: DiagnosticOrderStatus[] = [to];
				for (let step = current; step !== from; step = previous.get(step)!) {
					path.unshift(step);
				}
				return path;
			}
			queue.push(next);
		}
	}
	return null;
}

/**
 * The order header's status, derived from its tests: CANCELLED when every test is cancelled, else the status of the
 * least advanced test that still runs (an order is RELEASED once all of its live tests are).
 */
export function deriveOrderStatus(itemStatuses: readonly DiagnosticOrderStatus[]): DiagnosticOrderStatus {
	const live = itemStatuses.filter((status) => status !== 'CANCELLED');
	if (live.length === 0) {
		return 'CANCELLED';
	}
	return live.reduce((least, status) =>
		DIAGNOSTIC_STATUS_RANK[status] < DIAGNOSTIC_STATUS_RANK[least] ? status : least,
	);
}
