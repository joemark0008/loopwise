// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';

import { subscribeToExternalActiveClinicChanges } from './active-clinic';

it('notifies subscribers when another tab changes the active clinic', () => {
	const listener = vi.fn();
	const unsubscribe = subscribeToExternalActiveClinicChanges(listener);

	window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
	window.dispatchEvent(new StorageEvent('storage', { key: 'loopwise.active-clinic-id' }));

	expect(listener).toHaveBeenCalledOnce();
	unsubscribe();
});
