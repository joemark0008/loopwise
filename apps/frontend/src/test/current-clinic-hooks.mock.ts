import { useQuery } from '@tanstack/react-query';

import { procedures, queryClient } from '@/test/procedures';

/**
 * Stand-in for `@/hooks/use-current-clinic` in tests that mock TanStack Query and `@/test/procedures`: the hooks
 * read the clinic through the mocked `procedures.clinic.getCurrent`, as the code did before it moved to Apollo.
 * Use with `vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'))`.
 */
const clinic = () => (procedures as unknown as { clinic: Record<string, { queryOptions: () => object }> }).clinic;

export const useCurrentClinic = () => useQuery(clinic().getCurrent.queryOptions() as never);

export const useClinics = () =>
	useQuery((clinic().listForCurrentUser?.queryOptions() ?? { queryKey: ['clinics'] }) as never);

export const fetchCurrentClinic = () => queryClient.ensureQueryData(clinic().getCurrent.queryOptions() as never);

export const refetchClinicQueries = async () => undefined;
