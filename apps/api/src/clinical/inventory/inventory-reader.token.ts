/**
 * Provides `InventoryWiseReader` to the agent's tool context (`AgentToolServices['inventory']`). A token in its own
 * file, so the agent service, whose types the frontend imports, never pulls the Nest models into the frontend build.
 */
export const INVENTORY_READER = Symbol('INVENTORY_READER');
