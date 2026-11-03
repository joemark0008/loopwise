/**
 * Provides `PatientService` to the agent's tool context (`AgentToolServices['patients']`). A token rather than the
 * class, so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const PATIENT_READER = Symbol('PATIENT_READER');
