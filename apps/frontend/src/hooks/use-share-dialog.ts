import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useActiveClinicId } from '@/lib/active-clinic';
import { chatApi } from '@/lib/chat-api';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

export function useShareAudience() {
	const activeClinicId = useActiveClinicId();
	const clinic = useCurrentClinic();
	const clinicId = clinic.data?.id;
	const hasClinic = clinicId != null && (!activeClinicId || activeClinicId === clinicId);
	// Until user groups (Phase 6) every member may share with the whole clinic, as apps/api's share audience.
	const canShareToClinic = hasClinic;
	return {
		canShareToClinic,
		emptyMessage: canShareToClinic ? undefined : 'No other members in your groups',
	};
}

export function useMemberPicker(currentUserId: string | undefined, initialIds: string[] | undefined, chatId: string) {
	const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set(initialIds));
	const [search, setSearch] = useState('');

	const activeClinicId = useActiveClinicId();
	const clinic = useCurrentClinic();
	const clinicId = clinic.data?.id;
	const hasClinic = clinicId != null && (!activeClinicId || activeClinicId === clinicId);
	const membersQuery = useQuery({
		...chatApi.sharedChat.shareMembers.queryOptions({ chatId }),
		enabled: hasClinic,
	});

	const otherMembers = useMemo(() => {
		return hasClinic && !membersQuery.isFetching
			? (membersQuery.data ?? []).filter((m) => m.id !== currentUserId)
			: [];
	}, [hasClinic, membersQuery.data, membersQuery.isFetching, currentUserId]);

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
