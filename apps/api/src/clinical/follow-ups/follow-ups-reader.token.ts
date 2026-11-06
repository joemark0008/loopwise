/**
 * Provides `FollowUpWiseReader` to the agent's tool context (`AgentToolServices['followUps']`). A token in its own
 * file so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const FOLLOW_UPS_READER = Symbol('FOLLOW_UPS_READER');
