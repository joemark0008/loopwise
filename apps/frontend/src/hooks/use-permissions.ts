import { useMemo } from 'react';

import type { UserRole } from '@loopwise/shared/types';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

export function usePermissions() {
	const clinic = useCurrentClinic();
	const role = clinic.data?.userRole as UserRole | undefined;

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
			canChatWithLoopwiseData: role === 'admin' || role === 'context_admin',
			canStartNewChat: role !== 'viewer' && !!role,
			canViewSharedObjects: !!role,
		}),
		[role],
	);
}

export type Permissions = ReturnType<typeof usePermissions>;
export type PermissionKey = keyof Omit<Permissions, 'role'>;
