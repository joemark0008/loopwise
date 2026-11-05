import { redirect } from '@tanstack/react-router';

import type { UserRole } from '@loopwise/shared/types';
import { fetchPublicConfig } from '@/hooks/use-public-config';
import { fetchCurrentClinic } from '@/hooks/use-current-clinic';
import { canSeeAdvancedSettings } from '@/lib/effective-user-group-features';
import { CurrentOrgRoleDocument } from '@/graphql/generated/graphql';
import { apolloClient } from '@/lib/apollo-client';

export async function requireAdvancedSettingsAccess(pathname: string) {
	if (pathname.startsWith('/settings/account')) {
		return;
	}
	const clinic = await fetchCurrentClinic();
	if (!clinic) {
		return;
	}
	if (!canSeeAdvancedSettings(clinic.userRole as UserRole)) {
		throw redirect({ to: '/settings/account' });
	}
}

export async function requireAdmin() {
	const clinic = await fetchCurrentClinic();
	if (!clinic || clinic.userRole !== 'admin') {
		throw redirect({ to: '/settings/account' });
	}
}

/** Organization admins: the users page. A clinic admin role alone is not enough. */
export async function requireOrgAdmin() {
	const role = await apolloClient
		.query({ query: CurrentOrgRoleDocument, fetchPolicy: 'network-only' })
		.then(({ data }) => data?.currentOrgRole)
		.catch(() => undefined);
	if (role !== 'admin') {
		throw redirect({ to: '/settings/account' });
	}
}

export async function requireNonCloud() {
	const config = await fetchPublicConfig();
	if (config.loopwiseMode === 'cloud') {
		throw redirect({ to: '/settings/account' });
	}
}

export async function requireCloud() {
	const config = await fetchPublicConfig();
	if (config.loopwiseMode !== 'cloud') {
		throw redirect({ to: '/settings/account' });
	}
	return config;
}

export async function requireAdminNonCloud() {
	await requireAdmin();
	await requireNonCloud();
}

export async function requireNonViewerNonCloud() {
	await requireNonViewer();
	await requireNonCloud();
}

export async function requireContextAdminOrAdmin() {
	const clinic = await fetchCurrentClinic();
	if (!clinic || (clinic.userRole !== 'admin' && clinic.userRole !== 'context_admin')) {
		throw redirect({ to: '/settings/account' });
	}
}

export async function requireNonViewer() {
	const clinic = await fetchCurrentClinic();
	if (!clinic || clinic.userRole === 'viewer') {
		throw redirect({ to: '/settings/account' });
	}
}
