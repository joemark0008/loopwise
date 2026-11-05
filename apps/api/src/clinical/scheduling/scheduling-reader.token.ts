/**
 * Provides `SchedulingWiseReader` to the agent's tool context (`AgentToolServices['scheduling']`). A token in its own
 * file so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const SCHEDULING_READER = Symbol('SCHEDULING_READER');
