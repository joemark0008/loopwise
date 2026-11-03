import { canRoleSeeAdvancedSettings, DEFAULT_TOOL_CALL_DENSITY_POLICY } from '@quarry/shared';
import type { ToolCallDensityPolicy, UserGroupFeature } from '@quarry/shared';
import type { ToolCallDensity, UserRole } from '@quarry/shared/types';

export type EffectiveUserGroupFeatures = Record<UserGroupFeature, boolean>;

export interface EffectiveUserGroupAccess {
	features: EffectiveUserGroupFeatures;
	toolCallDensityPolicy: ToolCallDensityPolicy;
}

const DENIED_FEATURES: EffectiveUserGroupFeatures = {
	storyCreation: false,
	customStoryCreation: false,
	automationCreation: false,
};

const LOADING_ACCESS: EffectiveUserGroupAccess = {
	features: DENIED_FEATURES,
	toolCallDensityPolicy: {
		defaultDensity: 'detailed',
		canChange: false,
	},
};

const EXAMPLE_PROJECT_ACCESS: EffectiveUserGroupAccess = {
	features: {
		storyCreation: true,
		customStoryCreation: true,
		automationCreation: false,
	},
	toolCallDensityPolicy: {
		defaultDensity: 'detailed',
		canChange: false,
	},
};

/**
 * Stand-in for upstream `userGroup.effectiveAccess` until user groups come back (Phase 6, docs/deferred-features.md):
 * every member gets what upstream's default "All Users" group grants, minus automations (Phase 5).
 */
export const PROJECT_MEMBER_ACCESS: EffectiveUserGroupAccess = {
	features: {
		storyCreation: true,
		customStoryCreation: true,
		automationCreation: false,
	},
	toolCallDensityPolicy: DEFAULT_TOOL_CALL_DENSITY_POLICY,
};

/** Upstream's rule with the default group, which shows all settings: admins and context admins see them. */
export function canSeeAdvancedSettings(role: UserRole | null | undefined): boolean {
	return canRoleSeeAdvancedSettings(role, true);
}

export function getRenderableUserGroupAccess(
	access: EffectiveUserGroupAccess | undefined,
	isAvailable: boolean,
	isExampleProject = false,
): EffectiveUserGroupAccess {
	if (isExampleProject) {
		return EXAMPLE_PROJECT_ACCESS;
	}
	return isAvailable && access ? access : LOADING_ACCESS;
}

export function getEffectiveToolCallDensity(
	storedDensity: ToolCallDensity | undefined,
	policy: ToolCallDensityPolicy,
): ToolCallDensity {
	if (!policy.canChange) {
		return policy.defaultDensity;
	}
	return storedDensity ?? policy.defaultDensity;
}
