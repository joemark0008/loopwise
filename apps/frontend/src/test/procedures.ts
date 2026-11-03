import { QueryClient } from '@tanstack/react-query';

/**
 * Fake procedure tree for tests, keyed like the `lib/*-api.ts` modules (`procedures.story.resolve.queryOptions`…).
 * A test mocks this module with the procedures it needs, and mocks the api module under test to read from it:
 * `vi.mock('@/test/procedures', () => ({ procedures: { … } }))`.
 */
export const procedures: Record<string, unknown> = {};

export const queryClient = new QueryClient();
