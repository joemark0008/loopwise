import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireContextAdminOrAdmin } from './route-guards';

const mocks = vi.hoisted(() => ({
	ensureQueryData: vi.fn(),
}));

vi.mock('@/hooks/use-current-clinic', () => import('@/test/current-clinic-hooks.mock'));

vi.mock('@/test/procedures', () => ({
	queryClient: {
		ensureQueryData: mocks.ensureQueryData,
	},
	procedures: {
		organization: {
			get: {
				queryOptions: () => ({}),
			},
		},
		clinic: {
			getCurrent: {
				queryOptions: () => ({}),
			},
		},
		system: {
			getPublicConfig: {
				queryOptions: () => ({}),
			},
		},
	},
}));

describe('requireContextAdminOrAdmin', () => {
	beforeEach(() => {
		mocks.ensureQueryData.mockReset();
	});

	it.each(['admin', 'context_admin'])('allows a clinic %s without organization membership', async (userRole) => {
		mocks.ensureQueryData.mockResolvedValueOnce({ userRole });

		await expect(requireContextAdminOrAdmin()).resolves.toBeUndefined();
		expect(mocks.ensureQueryData).toHaveBeenCalledTimes(1);
	});

	it('redirects a regular clinic user', async () => {
		mocks.ensureQueryData.mockResolvedValueOnce({ userRole: 'user' });

		await expect(requireContextAdminOrAdmin()).rejects.toBeDefined();
		expect(mocks.ensureQueryData).toHaveBeenCalledTimes(1);
	});
});
