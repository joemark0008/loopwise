import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';

import { setActiveClinicId } from '@/lib/active-clinic';
import { apolloClient } from '@/lib/apollo-client';

export function useClinicSwitch(currentClinicId?: string) {
	const queryClient = useQueryClient();
	const router = useRouter();

	return useCallback(
		async (clinicId: string) => {
			if (!currentClinicId || clinicId === currentClinicId) {
				return false;
			}

			setActiveClinicId(clinicId);
			await Promise.all([queryClient.invalidateQueries(), apolloClient.resetStore()]);
			await router.invalidate();
			return true;
		},
		[currentClinicId, queryClient, router],
	);
}
