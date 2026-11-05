import { useCallback } from 'react';
import type { UserGroupFeature } from '@loopwise/shared';

import { useIsCloud } from '@/hooks/use-loopwise-mode';
import { getActiveClinicId } from '@/lib/active-clinic';
import { getRenderableUserGroupAccess, CLINIC_MEMBER_ACCESS } from '@/lib/effective-user-group-features';
import { useOptionalAgentContext } from '@/contexts/agent.provider';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

export function useEffectiveUserGroupFeatures() {
	const clinic = useCurrentClinic();
	const isCloud = useIsCloud();
	const activeClinicId = getActiveClinicId();
	const hasCurrentClinic = Boolean(clinic.data?.id) && (!activeClinicId || clinic.data?.id === activeClinicId);
	const isOnboarding = useOptionalAgentContext()?.mode === 'onboarding';
	const isExampleClinic = isCloud && clinic.isSuccess && clinic.data === null && !isOnboarding;
	const isLoading = clinic.isPending;
	const isError = clinic.isError;
	const access = getRenderableUserGroupAccess(
		CLINIC_MEMBER_ACCESS,
		hasCurrentClinic && !isLoading && !isError,
		isExampleClinic,
	);
	const { features, toolCallDensityPolicy } = access;
	const isFeatureEnabled = useCallback((feature: UserGroupFeature) => features[feature], [features]);

	return {
		features,
		storyCreationEnabled: features.storyCreation,
		customStoryCreationEnabled: features.customStoryCreation,
		automationCreationEnabled: features.automationCreation,
		toolCallDensityPolicy,
		isFeatureEnabled,
		isLoading,
		isError,
	};
}
