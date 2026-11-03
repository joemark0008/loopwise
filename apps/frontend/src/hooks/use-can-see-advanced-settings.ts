import type { UserRole } from '@loopwise/shared/types';

import { useCurrentProject } from '@/hooks/use-current-project';
import { canSeeAdvancedSettings } from '@/lib/effective-user-group-features';

export function useCanSeeAdvancedSettings(): boolean {
	const project = useCurrentProject();
	if (project.isSuccess && !project.data) {
		return true;
	}
	return canSeeAdvancedSettings(project.data?.userRole as UserRole | undefined);
}
