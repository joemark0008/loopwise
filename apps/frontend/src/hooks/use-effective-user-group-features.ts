import { useCallback } from 'react';
import type { UserGroupFeature } from '@loopwise/shared';

import { useIsCloud } from '@/hooks/use-loopwise-mode';
import { getActiveProjectId } from '@/lib/active-project';
import { getRenderableUserGroupAccess, PROJECT_MEMBER_ACCESS } from '@/lib/effective-user-group-features';
import { useOptionalAgentContext } from '@/contexts/agent.provider';
import { useCurrentProject } from '@/hooks/use-current-project';

export function useEffectiveUserGroupFeatures() {
	const project = useCurrentProject();
	const isCloud = useIsCloud();
	const activeProjectId = getActiveProjectId();
	const hasCurrentProject = Boolean(project.data?.id) && (!activeProjectId || project.data?.id === activeProjectId);
	const isOnboarding = useOptionalAgentContext()?.mode === 'onboarding';
	const isExampleProject = isCloud && project.isSuccess && project.data === null && !isOnboarding;
	const isLoading = project.isPending;
	const isError = project.isError;
	const access = getRenderableUserGroupAccess(
		PROJECT_MEMBER_ACCESS,
		hasCurrentProject && !isLoading && !isError,
		isExampleProject,
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
