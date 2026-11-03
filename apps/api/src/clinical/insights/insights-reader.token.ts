/**
 * Provides `InsightsService` to the agent's tool context (`AgentToolServices['insights']`). A token rather than the
 * class, so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const INSIGHTS_READER = Symbol('INSIGHTS_READER');
