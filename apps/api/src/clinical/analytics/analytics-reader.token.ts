/**
 * Provides `AnalyticsService` to the agent's tool context (`AgentToolServices['analytics']`). A token rather than the
 * class, so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const ANALYTICS_READER = Symbol('ANALYTICS_READER');
