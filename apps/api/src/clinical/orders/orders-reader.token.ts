/**
 * Provides `OrderService` to the agent's tool context (`AgentToolServices['orders']`), as `PATIENT_READER` does: a
 * token, so the frontend, which imports the agent's types, never pulls the Nest models.
 */
export const ORDERS_READER = Symbol('ORDERS_READER');
