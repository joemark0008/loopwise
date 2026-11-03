import type { OrderStatus } from '../../generated/prisma/enums.js';

/**
 * The order status machine (DESIGN.md §7): `draft → sent → accepted → collected → resulted → reviewed`, plus the
 * exits. A lab without a worklist step can result straight from `sent` or `accepted`; a late result reopens a reviewed
 * order. Migration 0018's
 * `check_order_transition` trigger enforces the same edges in Postgres; keep both in step.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
	draft: ['sent', 'cancelled'],
	sent: ['accepted', 'rejected', 'cancelled', 'resulted'],
	accepted: ['collected', 'cancelled', 'resulted'],
	collected: ['resulted'],
	resulted: ['reviewed'],
	// A result that arrives after review needs review again.
	reviewed: ['resulted'],
	cancelled: [],
	rejected: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
	return ORDER_TRANSITIONS[from].includes(to);
}

/** Who may move an order along: the target facility's staff, the ordering doctor, or the hub (HL7, results). */
export type OrderActor = 'lab' | 'orderer' | 'system';

/** The steps each actor takes; `canTransition` still decides whether the step fits the current status. */
export const ORDER_STEPS = {
	accept: { to: 'accepted', actor: 'lab', verb: 'accept' },
	reject: { to: 'rejected', actor: 'lab', verb: 'reject' },
	collect: { to: 'collected', actor: 'lab', verb: 'collect' },
	cancel: { to: 'cancelled', actor: 'orderer', verb: 'cancel' },
	result: { to: 'resulted', actor: 'system', verb: 'result' },
	review: { to: 'reviewed', actor: 'orderer', verb: 'review' },
} as const satisfies Record<string, { to: OrderStatus; actor: OrderActor; verb: string }>;

export type OrderStep = keyof typeof ORDER_STEPS;

const STATUS_LABELS: Record<OrderStatus, string> = {
	draft: 'a draft',
	sent: 'sent',
	accepted: 'accepted',
	collected: 'collected',
	resulted: 'resulted',
	reviewed: 'reviewed',
	cancelled: 'cancelled',
	rejected: 'rejected',
};

/** Why a step does not fit, for the error the user sees. */
export function transitionRefusal(from: OrderStatus, step: OrderStep): string {
	return `This order is ${STATUS_LABELS[from]}; it can't be ${ORDER_STEPS[step].to} now.`;
}
