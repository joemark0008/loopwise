// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useSavedPromptsQuery } from './use-saved-prompts';

const mocks = vi.hoisted(() => ({
	queries: [] as Array<{ queryKey: string[]; enabled?: boolean }>,
	clinicQuery: { data: undefined as unknown, isPending: true, isError: false, isLoading: true },
	savedPromptsData: [{ id: 'prompt-id' }],
}));

vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[]; enabled?: boolean }) => {
		mocks.queries.push(options);
		return options.queryKey[0] === 'current-clinic'
			? mocks.clinicQuery
			: { data: mocks.savedPromptsData, isPending: false, isError: false, isLoading: false };
	},
}));

/** The clinic procedures moved to apps/api read the same mocked procedures as `procedures.clinic`. */
vi.mock('@/lib/clinic-api', async () => {
	const { procedures } = (await import('@/test/procedures')) as unknown as { procedures: { clinic: unknown } };
	return { clinicApi: { clinic: procedures.clinic } };
});

vi.mock('@/test/procedures', () => ({
	procedures: {
		clinic: {
			getCurrent: { queryOptions: () => ({ queryKey: ['current-clinic'] }) },
			getSavedPrompts: { queryOptions: () => ({ queryKey: ['saved-prompts'] }) },
			getClinicSavedPrompts: { queryOptions: () => ({ queryKey: ['clinic-saved-prompts'] }) },
		},
	},
}));

afterEach(() => {
	cleanup();
	mocks.queries = [];
	mocks.clinicQuery = { data: undefined, isPending: true, isError: false, isLoading: true };
	mocks.savedPromptsData = [{ id: 'prompt-id' }];
});

it('stays loading while the current clinic is pending', () => {
	const { result } = renderHook(() => useSavedPromptsQuery());

	expect(mocks.queries.find((query) => query.queryKey[0] === 'saved-prompts')?.enabled).toBe(false);
	expect(result.current.isLoading).toBe(true);
});

it('requests saved prompts when the current clinic query fails', () => {
	mocks.clinicQuery = { data: undefined, isPending: false, isError: true, isLoading: false };

	renderHook(() => useSavedPromptsQuery());

	expect(mocks.queries.find((query) => query.queryKey[0] === 'saved-prompts')?.enabled).toBe(true);
});

it('hides cached saved prompts when there is no current clinic', () => {
	mocks.clinicQuery = { data: null, isPending: false, isError: false, isLoading: false };

	const { result } = renderHook(() => useSavedPromptsQuery());

	expect(result.current.data).toBeUndefined();
});

it('reads the given clinic saved prompts without a current clinic', () => {
	mocks.clinicQuery = { data: null, isPending: false, isError: false, isLoading: false };

	const { result } = renderHook(() => useSavedPromptsQuery('example-clinic'));

	expect(mocks.queries.find((query) => query.queryKey[0] === 'saved-prompts')?.enabled).toBe(false);
	expect(mocks.queries.find((query) => query.queryKey[0] === 'clinic-saved-prompts')?.enabled).toBe(true);
	expect(result.current.data).toEqual([{ id: 'prompt-id' }]);
});
