export interface BackoffPolicy {
	baseMs: number;
	maxMs: number;
}

/** Exponential backoff with a cap: base, 2×base, 4×base, … up to max. `attempt` is 1 after the first failure. */
export function backoffDelay(attempt: number, policy: BackoffPolicy): number {
	const exponent = Math.max(0, attempt - 1);
	return Math.min(policy.maxMs, policy.baseMs * 2 ** Math.min(exponent, 30));
}
