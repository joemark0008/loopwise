import { createLocalStorage } from './local-storage';

/** The organization picked in the switcher; switching organizations comes back with Phase 6. */
const activeOrganizationStorage = createLocalStorage<string>('loopwise.active-organization-id');

export function getActiveOrganizationId(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}

	return activeOrganizationStorage.get();
}

export function setActiveOrganizationId(organizationId: string | null): void {
	if (typeof window === 'undefined') {
		return;
	}

	activeOrganizationStorage.set(organizationId);
}
