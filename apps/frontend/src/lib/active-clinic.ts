import { useSyncExternalStore } from 'react';

import { createLocalStorage } from './local-storage';

const ACTIVE_CLINIC_STORAGE_KEY = 'loopwise.active-clinic-id';
const activeClinicStorage = createLocalStorage<string>(ACTIVE_CLINIC_STORAGE_KEY);
const listeners = new Set<() => void>();
const externalChangeListeners = new Set<() => void>();

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

if (typeof window !== 'undefined') {
	window.addEventListener('storage', (event) => {
		if (event.key !== null && event.key !== ACTIVE_CLINIC_STORAGE_KEY) {
			return;
		}
		for (const listener of externalChangeListeners) {
			listener();
		}
		for (const listener of listeners) {
			listener();
		}
	});
}

export function subscribeToExternalActiveClinicChanges(listener: () => void) {
	externalChangeListeners.add(listener);
	return () => {
		externalChangeListeners.delete(listener);
	};
}

export function getActiveClinicId(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return activeClinicStorage.get();
}

export function setActiveClinicId(clinicId: string | null): void {
	if (typeof window === 'undefined') {
		return;
	}

	if (clinicId === getActiveClinicId()) {
		return;
	}
	activeClinicStorage.set(clinicId);
	for (const listener of listeners) {
		listener();
	}
}

export function useActiveClinicId(): string | null {
	return useSyncExternalStore(subscribe, getActiveClinicId, () => null);
}

export function getClinicRequestHeaders(): Record<string, string> {
	const activeClinicId = getActiveClinicId();

	return activeClinicId ? { 'x-loopwise-clinic-id': activeClinicId } : {};
}
