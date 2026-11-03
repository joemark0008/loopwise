import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActiveProjectId } from '@/lib/active-project';
import { chatApi } from '@/lib/chat-api';
import { useCurrentProject } from '@/hooks/use-current-project';

export function useShareAudience() {
	const activeProjectId = useActiveProjectId();
	const project = useCurrentProject();
	const projectId = project.data?.id;
	const hasProject = projectId != null && (!activeProjectId || activeProjectId === projectId);
	// Until user groups (Phase 6) every member may share with the whole project, as apps/api's share audience.
	const canShareToProject = hasProject;
	return {
		canShareToProject,
		emptyMessage: canShareToProject ? undefined : 'No other members in your groups',
	};
}

export function useMemberPicker(currentUserId: string | undefined, initialIds: string[] | undefined, chatId: string) {
	const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set(initialIds));
	const [search, setSearch] = useState('');

	const activeProjectId = useActiveProjectId();
	const project = useCurrentProject();
	const projectId = project.data?.id;
	const hasProject = projectId != null && (!activeProjectId || activeProjectId === projectId);
	const membersQuery = useQuery({
		...chatApi.sharedChat.shareMembers.queryOptions({ chatId }),
		enabled: hasProject,
	});

	const otherMembers = useMemo(() => {
		return hasProject && !membersQuery.isFetching
			? (membersQuery.data ?? []).filter((m) => m.id !== currentUserId)
			: [];
	}, [hasProject, membersQuery.data, membersQuery.isFetching, currentUserId]);

	const filteredMembers = useMemo(() => {
		if (!search.trim()) {
			return otherMembers;
		}
		const q = search.toLowerCase();
		return otherMembers.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
	}, [otherMembers, search]);

	const toggleUser = useCallback((userId: string) => {
		setSelectedUserIds((prev) => {
			const next = new Set(prev);
			if (next.has(userId)) {
				next.delete(userId);
			} else {
				next.add(userId);
			}
			return next;
		});
	}, []);

	const reset = useCallback((ids?: string[]) => {
		setSelectedUserIds(new Set(ids));
		setSearch('');
	}, []);

	return {
		selectedUserIds,
		setSelectedUserIds,
		search,
		setSearch,
		otherMembers,
		filteredMembers,
		toggleUser,
		isLoading: membersQuery.isFetching,
		membersQuery,
		reset,
	};
}

export function useCopyWithFeedback(delay = 1500) {
	const [isCopied, setIsCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(timeoutRef.current), []);

	const copy = useCallback(
		(text: string) => {
			navigator.clipboard.writeText(text);
			setIsCopied(true);
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => setIsCopied(false), delay);
		},
		[delay],
	);

	return { isCopied, copy };
}
