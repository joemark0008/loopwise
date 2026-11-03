/**
 * Provides `ReportsService` to the agent's tool context (`AgentToolServices['reports']`). A token rather than the
 * class, so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const REPORTS_READER = Symbol('REPORTS_READER');
