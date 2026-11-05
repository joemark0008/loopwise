import type { UserRole } from '@loopwise/shared/types';

import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { canSeeAdvancedSettings } from '@/lib/effective-user-group-features';

export function useCanSeeAdvancedSettings(): boolean {
	const clinic = useCurrentClinic();
	if (clinic.isSuccess && !clinic.data) {
		return true;
	}
	return canSeeAdvancedSettings(clinic.data?.userRole as UserRole | undefined);
}
