import type { OrderPriority } from '@/graphql/generated/graphql';

const PRIORITY_RANK: Record<OrderPriority, number> = { stat: 0, urgent: 1, routine: 2 };

/** Worklist order: STAT first, then urgent, then routine; oldest first within each. */
export function byPriorityThenAge<T extends { priority: OrderPriority; sentAt: string | null; createdAt: string }>(
	orders: readonly T[],
): T[] {
	const time = (order: T) => new Date(order.sentAt ?? order.createdAt).getTime();
	return [...orders].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || time(a) - time(b));
}

/** How long an order has waited: `12 min`, `3 h`, `2 d`. */
export function waitingFor(since: string, now = new Date()): string {
	const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
	if (minutes < 60) {
		return `${minutes} min`;
	}
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}
