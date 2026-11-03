/**
 * Provides `RulesService` to the agent's tool context (`AgentToolServices['rules']`). A token rather than the class,
 * so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const RULES_READER = Symbol('RULES_READER');
