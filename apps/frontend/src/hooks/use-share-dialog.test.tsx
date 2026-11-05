// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { useMemberPicker, useShareAudience } from './use-share-dialog';

const mocks = vi.hoisted(() => ({
	activeClinicId: null as string | null,
	isFetching: false,
	clinic: null as { id: string } | null,
	queries: [] as Array<{ queryKey: string[]; enabled?: boolean }>,
}));

vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[]; enabled?: boolean }) => {
		mocks.queries.push(options);
		switch (options.queryKey[0]) {
			case 'clinic':
				return { data: mocks.clinic };
			case 'members':
				return {
					data: [{ id: 'old-member', name: 'Old member', email: 'old@example.com' }],
					isFetching: mocks.isFetching,
				};
			default:
				return { data: undefined, isFetching: false };
		}
	},
}));

vi.mock('@/lib/active-clinic', () => ({
	useActiveClinicId: () => mocks.activeClinicId,
}));

vi.mock('@/test/procedures', () => ({
	procedures: {
		clinic: {
			getCurrent: { queryOptions: () => ({ queryKey: ['clinic'] }) },
		},
	},
}));

vi.mock('@/lib/chat-api', () => ({
	chatApi: {
		sharedChat: { shareMembers: { queryOptions: () => ({ queryKey: ['members'] }) } },
	},
}));

beforeEach(() => {
	mocks.activeClinicId = null;
	mocks.isFetching = false;
	mocks.clinic = null;
	mocks.queries = [];
});

it('hides sharing and cached members when no clinic is active', () => {
	const { result } = renderHook(() => ({
		audience: useShareAudience(),
		memberPicker: useMemberPicker('current-user', undefined, 'chat-id'),
	}));

	expect(result.current.audience.canShareToClinic).toBe(false);
	expect(result.current.memberPicker.otherMembers).toEqual([]);
	expect(result.current.memberPicker.filteredMembers).toEqual([]);
	expect(mocks.queries.find((query) => query.queryKey[0] === 'members')?.enabled).toBe(false);
});

it('hides previous clinic members while the selected clinic refetches', () => {
	mocks.activeClinicId = 'new-clinic';
	mocks.isFetching = true;
	mocks.clinic = { id: 'new-clinic' };

	const { result } = renderHook(() => ({
		audience: useShareAudience(),
		memberPicker: useMemberPicker('current-user', undefined, 'chat-id'),
	}));

	// Every member may share with the clinic until user groups come back (Phase 6).
	expect(result.current.audience.canShareToClinic).toBe(true);
	expect(result.current.memberPicker.otherMembers).toEqual([]);
	expect(result.current.memberPicker.isLoading).toBe(true);
});
