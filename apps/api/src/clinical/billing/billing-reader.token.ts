/**
 * Provides `CashierDeskService` to the agent's tool context (`AgentToolServices['billing']`, the `list_billing` tool).
 * A token in its own file so the agent service, whose types the frontend imports, never pulls the Nest models into the
 * frontend build.
 */
export const BILLING_READER = Symbol('BILLING_READER');
