// @vitest-environment jsdom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsSearch } from './use-settings-search';

const mocks = vi.hoisted(() => ({
	config: { betaSubagentsEnabled: false },
	canSeeAdvancedSettings: true,
	isCloud: false,
	permissions: { isAdmin: false, isContextAdmin: false, isViewer: true },
}));

vi.mock('@/hooks/use-public-config', () => ({
	usePublicConfig: () => ({ data: mocks.config, isPending: false }),
}));

vi.mock('@/hooks/use-can-see-advanced-settings', () => ({
	useCanSeeAdvancedSettings: () => mocks.canSeeAdvancedSettings,
}));

vi.mock('@/hooks/use-loopwise-mode', () => ({
	useIsCloud: () => mocks.isCloud,
}));

vi.mock('@/hooks/use-permissions', () => ({
	usePermissions: () => mocks.permissions,
}));

describe('useSettingsSearch', () => {
	beforeEach(() => {
		mocks.canSeeAdvancedSettings = true;
		Object.assign(mocks.permissions, { isAdmin: false, isContextAdmin: false, isViewer: true });
	});

	afterEach(cleanup);

	it('finds project settings for admins', () => {
		Object.assign(mocks.permissions, { isAdmin: true, isViewer: false });
		const { result } = renderHook(() => useSettingsSearch('skills'));

		expect(result.current.map((entry) => entry.page)).toContain('/settings/project/skills');
	});

	it('finds the agent page for members', () => {
		Object.assign(mocks.permissions, { isViewer: false });
		const { result } = renderHook(() => useSettingsSearch('saved prompts'));

		expect(result.current.map((entry) => entry.page)).toContain('/settings/project/agent');
	});

	it('keeps members without advanced settings on their account page', () => {
		mocks.canSeeAdvancedSettings = false;
		const { result } = renderHook(() => useSettingsSearch('skills'));

		expect(result.current.every((entry) => entry.page === '/settings/account')).toBe(true);
	});

	it('returns nothing for a one-letter query', () => {
		const { result } = renderHook(() => useSettingsSearch('w'));

		expect(result.current).toEqual([]);
	});
});
