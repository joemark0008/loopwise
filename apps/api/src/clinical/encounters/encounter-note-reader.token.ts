/**
 * Provides `EncounterRecordService` to the agent's tool context (`AgentToolServices['encounters']`), as
 * `PATIENT_READER` does: a token, so the frontend, which imports the agent's types, never pulls the Nest models.
 */
export const ENCOUNTER_NOTE_READER = Symbol('ENCOUNTER_NOTE_READER');
