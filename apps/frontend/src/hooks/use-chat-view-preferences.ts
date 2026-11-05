import { useCallback, useState } from 'react';
import { CHAT_GROUP_BY_OPTIONS } from '@loopwise/shared/types';
import type { ChatFilterType, ChatGroupBy } from '@loopwise/shared/types';

const GROUP_BY_KEY = 'sidebar-chat-group-by';
const FILTERS_KEY = 'sidebar-chat-filters';

export function useChatViewPreferences() {
	const [groupBy, setGroupByState] = useState<ChatGroupBy>(() => readStoredGroupBy());

	const [filters, setFiltersState] = useState<ChatFilterType[]>(() => {
		try {
			const stored = localStorage.getItem(FILTERS_KEY);
			return stored ? JSON.parse(stored) : ['all'];
		} catch {
			return ['all'];
		}
	});

	const setGroupBy = useCallback((value: ChatGroupBy) => {
		setGroupByState(value);
		localStorage.setItem(GROUP_BY_KEY, value);
	}, []);

	const toggleFilter = useCallback((filter: ChatFilterType) => {
		setFiltersState((prev) => {
			let next: ChatFilterType[];
			if (filter === 'all') {
				next = ['all'];
			} else {
				const without = prev.filter((f) => f !== 'all');
				if (without.includes(filter)) {
					next = without.filter((f) => f !== filter);
				} else {
					next = [...without, filter];
				}
				if (next.length === 0) {
					next = ['all'];
				}
			}
			localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
			return next;
		});
	}, []);

	return { groupBy, filters, setGroupBy, toggleFilter };
}

/** The saved grouping, or `none` when it is missing or a value that no longer exists (such as `project`). */
function readStoredGroupBy(): ChatGroupBy {
	const stored = localStorage.getItem(GROUP_BY_KEY);
	return CHAT_GROUP_BY_OPTIONS.includes(stored as ChatGroupBy) ? (stored as ChatGroupBy) : 'none';
}
