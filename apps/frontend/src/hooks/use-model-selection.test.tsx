// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useModelSelection } from './use-model-selection';

const mocks = vi.hoisted(() => ({
	queries: [] as Array<{ queryKey: string[]; enabled?: boolean }>,
	currentClinicQuery: { data: null as unknown, isPending: false, isError: false },
}));

vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'));

vi.mock('@tanstack/react-query', () => ({
	useQuery: (options: { queryKey: string[]; enabled?: boolean }) => {
		mocks.queries.push(options);
		return options.queryKey[0] === 'current-clinic'
			? mocks.currentClinicQuery
			: { data: [{ provider: 'openai' }], isPending: false, isError: false };
	},
}));

vi.mock('@/contexts/agent.provider', () => ({
	useAgentContext: () => ({
		selectedModel: null,
		usesDefaultModel: true,
		setSelectedModel: vi.fn(),
	}),
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
			getDefaultChatModel: { queryOptions: () => ({ queryKey: ['default-model'] }) },
			listAvailableTranscribeModels: { queryOptions: () => ({ queryKey: ['available-models'] }) },
		},
	},
}));

afterEach(() => {
	cleanup();
	mocks.queries = [];
	mocks.currentClinicQuery = { data: null, isPending: false, isError: false };
});

it('does not request clinic models when the user has no clinic', () => {
	const { result } = renderHook(() => useModelSelection());

	expect(mocks.queries.find((query) => query.queryKey[0] === 'available-models')?.enabled).toBe(false);
	expect(mocks.queries.find((query) => query.queryKey[0] === 'default-model')?.enabled).toBe(false);
	expect(result.current.availableModels).toBeUndefined();
	expect(result.current.hasClinic).toBe(false);
});

it('requests clinic models when the current clinic query fails', () => {
	mocks.currentClinicQuery = { data: undefined, isPending: false, isError: true };

	const { result } = renderHook(() => useModelSelection());

	expect(mocks.queries.find((query) => query.queryKey[0] === 'available-models')?.enabled).toBe(true);
	expect(mocks.queries.find((query) => query.queryKey[0] === 'default-model')?.enabled).toBe(true);
	expect(result.current.availableModels).toEqual([{ provider: 'openai' }]);
	expect(result.current.hasClinic).toBe(true);
});
