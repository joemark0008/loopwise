/**
 * Provides `ScribeWiseReader` to the agent's tool context (`AgentToolServices['scribe']`). A token in its own file, so
 * the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const SCRIBE_READER = Symbol('SCRIBE_READER');
