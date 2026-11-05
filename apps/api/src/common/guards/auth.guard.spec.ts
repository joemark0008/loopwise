import type { UserRole } from '@loopwise/shared/types';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../auth/auth.service.js';
import type { ClinicRepository } from '../../clinics/clinic.repository.js';
import type { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicAccess, ClinicAdmin, ClinicNonViewer, OrgAdmin, OrgMember } from '../decorators/access.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import type { LoopwiseRequest } from '../request.js';
import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';

const USER = { id: 'user-1', email: 'user@example.com' };
const CLINIC = { id: 'clinic-1', orgId: 'org-1', name: 'Clinic' };
const ORGANIZATION = { id: 'org-1', name: 'Org' };

class Handlers {
	@Public()
	publicRoute() {}

	protectedRoute() {}

	@ClinicAccess()
	clinicRoute() {}

	@ClinicNonViewer()
	nonViewerRoute() {}

	@ClinicAdmin()
	clinicAdminRoute() {}

	@OrgMember()
	orgMemberRoute() {}

	@OrgAdmin()
	orgAdminRoute() {}

	@OrgAdmin({ strict: true })
	orgAdminOnlyRoute() {}
}

type Route = Exclude<keyof Handlers, 'constructor'>;

const state = {
	signedIn: true,
	clinicRole: 'user' as UserRole | null,
	hasClinic: true,
	orgRole: 'user' as string | null,
};

const getSession = vi.fn(async () =>
	state.signedIn ? { user: USER, session: { id: 'session-1', userId: USER.id } } : null,
);

const clinics = {
	getClinicByUserId: vi.fn(async () => (state.hasClinic && state.clinicRole ? CLINIC : null)),
	getUserRoleInClinic: vi.fn(async () => state.clinicRole),
} as unknown as ClinicRepository;

const organizations = {
	getUserOrgMembership: vi.fn(async () =>
		state.orgRole
			? { orgId: ORGANIZATION.id, userId: USER.id, role: state.orgRole, organization: ORGANIZATION }
			: null,
	),
	getUserOrgMembershipByClinic: vi.fn(async () =>
		state.orgRole
			? { orgId: ORGANIZATION.id, userId: USER.id, role: state.orgRole, organization: ORGANIZATION }
			: null,
	),
} as unknown as OrganizationRepository;

const guard = new AuthGuard(
	new Reflector(),
	{ getSession } as unknown as AuthService,
	new AccessService(clinics, organizations),
);

function contextFor(route: Route, headers: Record<string, string> = {}) {
	const req = { headers } as unknown as LoopwiseRequest;
	const context = new ExecutionContextHost([req, {}, () => undefined], Handlers, Handlers.prototype[route]);
	context.setType('http');
	return { req, context: context as unknown as ExecutionContext };
}

async function run(route: Route, headers?: Record<string, string>) {
	const { req, context } = contextFor(route, headers);
	return { result: await guard.canActivate(context), req };
}

beforeEach(() => {
	Object.assign(state, { signedIn: true, clinicRole: 'user', hasClinic: true, orgRole: 'user' });
	vi.clearAllMocks();
});

describe('@Public()', () => {
	it('allows anonymous requests', async () => {
		state.signedIn = false;
		await expect(run('publicRoute')).resolves.toMatchObject({ result: true });
	});

	it('still attaches the session when there is one', async () => {
		const { req } = await run('publicRoute');
		expect(req.user).toEqual(USER);
	});
});

describe('default (protected)', () => {
	it('allows a signed-in user', async () => {
		const { result, req } = await run('protectedRoute');
		expect(result).toBe(true);
		expect(req.session).toMatchObject({ id: 'session-1' });
	});

	it('rejects anonymous requests with UNAUTHORIZED', async () => {
		state.signedIn = false;
		await expect(run('protectedRoute')).rejects.toMatchObject({ codeMessage: 'UNAUTHORIZED' });
	});
});

describe('@ClinicAccess()', () => {
	it.each(['admin', 'user', 'viewer', 'context_admin'] as const)('allows a %s and sets the clinic', async (role) => {
		state.clinicRole = role;
		const { result, req } = await run('clinicRoute');
		expect(result).toBe(true);
		expect(req.clinic).toEqual(CLINIC);
		expect(req.userRole).toBe(role);
	});

	it('passes the selected clinic header to the lookup', async () => {
		await run('clinicRoute', { 'x-loopwise-clinic-id': 'clinic-1' });
		expect(clinics.getClinicByUserId).toHaveBeenCalledWith(USER.id, 'clinic-1');
	});

	it('rejects users without a clinic', async () => {
		state.hasClinic = false;
		await expect(run('clinicRoute')).rejects.toMatchObject({
			codeMessage: 'BAD_REQUEST',
			message: 'No clinic configured',
		});
	});

	it('rejects anonymous requests before looking up the clinic', async () => {
		state.signedIn = false;
		await expect(run('clinicRoute')).rejects.toMatchObject({ codeMessage: 'UNAUTHORIZED' });
		expect(clinics.getClinicByUserId).not.toHaveBeenCalled();
	});
});

describe('@ClinicNonViewer()', () => {
	it.each(['admin', 'user', 'context_admin'] as const)('allows a %s', async (role) => {
		state.clinicRole = role;
		await expect(run('nonViewerRoute')).resolves.toMatchObject({ result: true });
	});

	it('rejects a viewer', async () => {
		state.clinicRole = 'viewer';
		await expect(run('nonViewerRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Viewers cannot access this resource',
		});
	});
});

describe('@ClinicAdmin()', () => {
	it('allows an admin', async () => {
		state.clinicRole = 'admin';
		await expect(run('clinicAdminRoute')).resolves.toMatchObject({ result: true });
	});

	it.each(['user', 'viewer', 'context_admin'] as const)('rejects a %s', async (role) => {
		state.clinicRole = role;
		await expect(run('clinicAdminRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Only admins can perform this action',
		});
	});
});

describe('@OrgMember()', () => {
	it('allows a member and sets the organization', async () => {
		const { result, req } = await run('orgMemberRoute');
		expect(result).toBe(true);
		expect(req.organization).toEqual(ORGANIZATION);
		expect(req.orgRole).toBe('user');
	});

	it('resolves the organization from the selected organization header first', async () => {
		await run('orgMemberRoute', { 'x-loopwise-organization-id': 'org-1', 'x-loopwise-clinic-id': 'clinic-1' });
		expect(organizations.getUserOrgMembership).toHaveBeenCalledWith(USER.id, 'org-1');
		expect(organizations.getUserOrgMembershipByClinic).not.toHaveBeenCalled();
	});

	it('falls back to the selected clinic organization', async () => {
		await run('orgMemberRoute', { 'x-loopwise-clinic-id': 'clinic-1' });
		expect(organizations.getUserOrgMembershipByClinic).toHaveBeenCalledWith(USER.id, 'clinic-1');
	});

	it('rejects non-members with NOT_FOUND', async () => {
		state.orgRole = null;
		await expect(run('orgMemberRoute')).rejects.toMatchObject({
			codeMessage: 'NOT_FOUND',
			message: 'You are not a member of any organization',
		});
	});
});

describe('@OrgAdmin()', () => {
	it('resolves the organization for any member and leaves the role check to the handler', async () => {
		const { result, req } = await run('orgAdminRoute');
		expect(result).toBe(true);
		expect(req.orgRole).toBe('user');
	});

	it('with strict, allows an admin', async () => {
		state.orgRole = 'admin';
		await expect(run('orgAdminOnlyRoute')).resolves.toMatchObject({ result: true });
	});

	it('with strict, rejects a non-admin member', async () => {
		await expect(run('orgAdminOnlyRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Only organization admins can perform this action',
		});
	});
});

describe('session lookup', () => {
	it('looks the session up once per request', async () => {
		const { req, context } = contextFor('clinicRoute');
		await Promise.all([guard.canActivate(context), guard.canActivate(context)]);
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(req.user).toEqual(USER);
	});
});
