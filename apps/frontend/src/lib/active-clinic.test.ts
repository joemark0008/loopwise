// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';

import { defaultClinicId, subscribeToExternalActiveClinicChanges } from './active-clinic';

it('notifies subscribers when another tab changes the active clinic', () => {
	const listener = vi.fn();
	const unsubscribe = subscribeToExternalActiveClinicChanges(listener);

	window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
	window.dispatchEvent(new StorageEvent('storage', { key: 'loopwise.active-clinic-id' }));

	expect(listener).toHaveBeenCalledOnce();
	unsubscribe();
});

it('starts a new record at the active clinic when it is offered, else at the first', () => {
	const clinics = [{ id: 'tag' }, { id: 'ace' }];
	expect(defaultClinicId(clinics, 'ace')).toBe('ace');
	expect(defaultClinicId(clinics, null)).toBe('tag');
	expect(defaultClinicId(clinics, 'elsewhere')).toBe('tag');
	expect(defaultClinicId([], 'ace')).toBe('');
});
