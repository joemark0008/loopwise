import { useQuery } from '@tanstack/react-query';

import { procedures, queryClient } from '@/test/procedures';

/**
 * Stand-in for `@/hooks/use-current-project` in tests that mock TanStack Query and `@/test/procedures`: the hooks
 * read the project through the mocked `procedures.project.getCurrent`, as the code did before it moved to Apollo.
 * Use with `vi.mock('@/hooks/use-current-project', () => import('@/test/current-project-hooks.mock'))`.
 */
const project = () => (procedures as unknown as { project: Record<string, { queryOptions: () => object }> }).project;

export const useCurrentProject = () => useQuery(project().getCurrent.queryOptions() as never);

export const useProjects = () =>
	useQuery((project().listForCurrentUser?.queryOptions() ?? { queryKey: ['projects'] }) as never);

export const fetchCurrentProject = () => queryClient.ensureQueryData(project().getCurrent.queryOptions() as never);

export const refetchProjectQueries = async () => undefined;
