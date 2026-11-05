/**
 * Provides `DiagnosticsWiseReader` to the agent's tool context (`AgentToolServices['diagnostics']`). A token in its own
 * file rather than next to the class, so the agent service, whose types the frontend imports, never pulls the Nest
 * models into the frontend build.
 */
export const DIAGNOSTICS_READER = Symbol('DIAGNOSTICS_READER');
