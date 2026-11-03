/**
 * Provides `ResultsService` to the agent's tool context (`AgentToolServices['results']`), as `PATIENT_READER` does: a
 * token, so the frontend, which imports the agent's types, never pulls the Nest models.
 */
export const RESULTS_READER = Symbol('RESULTS_READER');
