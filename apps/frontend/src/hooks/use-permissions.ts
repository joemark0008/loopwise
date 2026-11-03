import { useMemo } from 'react';

import type { UserRole } from '@quarry/shared/types';
import { useCurrentProject } from '@/hooks/use-current-project';

export function usePermissions() {
	const project = useCurrentProject();
	const role = project.data?.userRole as UserRole | undefined;

	return useMemo(
		() => ({
			role,
			isAdmin: role === 'admin',
			isUser: role === 'user',
			isViewer: role === 'viewer',
			isContextAdmin: role === 'context_admin',
			canSendMessages: role === 'admin' || role === 'user' || role === 'context_admin',
			canShare: role === 'admin' || role === 'user' || role === 'context_admin',
			canEditSettings: role === 'admin',
			canInvite: role === 'admin',
			canViewUsage: role === 'admin' || role === 'user' || role === 'context_admin',
			canViewAllUsage: role === 'admin',
			canViewRecommendations: role === 'admin' || role === 'context_admin',
			canChatWithQuarryData: role === 'admin' || role === 'context_admin',
			canStartNewChat: role !== 'viewer' && !!role,
			canViewSharedObjects: !!role,
		}),
		[role],
	);
}

export type Permissions = ReturnType<typeof usePermissions>;
export type PermissionKey = keyof Omit<Permissions, 'role'>;
