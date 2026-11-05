import type { OrgRole, StaffRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../auth/auth.service.js';
import type { ConfigService } from '../../config/config.service.js';
import { ClinicAccess, ClinicAdmin, ClinicNonViewer, OrgAdmin, OrgMember } from '../decorators/access.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import type { LoopwiseRequest } from '../request.js';
import type { AccessRepository } from './access.repository.js';
import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';

const USER = { id: '01933b2a-0000-7000-8000-000000000001', email: 'user@example.com' };
const CLINIC_ID = '01933b2a-0000-7000-8000-0000000000c1';
const ORG_ID = '01933b2a-0000-7000-8000-0000000000a1';
const CLINIC = { id: CLINIC_ID, organizationId: ORG_ID, name: 'Clinic' };
const OTHER_CLINIC = { id: '01933b2a-0000-7000-8000-0000000000c2', organizationId: ORG_ID, name: 'Annex' };
const ORGANIZATION = { id: ORG_ID, name: 'Org' };

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

	@ClinicAccess({ staffRoles: ['CASHIER', 'BILLING_CLERK'] })
	cashierDeskRoute() {}

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
	staffRoles: ['MEMBER'] as StaffRole[],
	hasClinic: true,
	orgRole: 'MEMBER' as OrgRole | null,
};

const getSession = vi.fn(async () =>
	state.signedIn ? { user: USER, session: { id: 'session-1', userId: USER.id } } : null,
);

const access = {
	listClinicGrants: vi.fn(async () =>
		state.hasClinic
			? [
					{ clinic: OTHER_CLINIC, staffRoles: ['VIEWER'], orgRole: null },
					{ clinic: CLINIC, staffRoles: state.staffRoles, orgRole: null },
				]
			: [],
	),
	getClinicByPath: vi.fn(async () => null),
	getFirstClinic: vi.fn(async () => CLINIC),
	listOrganizationGrants: vi.fn(async () =>
		state.orgRole ? [{ organization: ORGANIZATION, orgRole: state.orgRole, staffRoles: [] }] : [],
	),
} as unknown as AccessRepository;

const config = { env: {} } as unknown as ConfigService;

const guard = new AuthGuard(
	new Reflector(),
	{ getSession } as unknown as AuthService,
	new AccessService(access, config),
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
	Object.assign(state, { signedIn: true, staffRoles: ['MEMBER'], hasClinic: true, orgRole: 'MEMBER' });
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

const ROLES_FOR: Record<UserRole, StaffRole[]> = {
	admin: ['DOCTOR', 'ADMIN'],
	user: ['NURSE'],
	viewer: ['VIEWER'],
	context_admin: ['CONTEXT_ADMIN'],
};

describe('@ClinicAccess()', () => {
	it.each(['admin', 'user', 'viewer', 'context_admin'] as const)('allows a %s and sets the clinic', async (role) => {
		state.staffRoles = ROLES_FOR[role];
		const { result, req } = await run('clinicRoute');
		expect(result).toBe(true);
		expect(req.clinic).toEqual(CLINIC);
		expect(req.userRole).toBe(role);
		expect(req.staffRoles).toEqual(ROLES_FOR[role]);
	});

	it('uses the selected clinic header when the user can open it', async () => {
		const { req } = await run('clinicRoute', { 'x-loopwise-clinic-id': OTHER_CLINIC.id });
		expect(req.clinic).toEqual(OTHER_CLINIC);
		expect(req.userRole).toBe('viewer');
	});

	it('falls back to the default clinic for an unknown selection', async () => {
		const { req } = await run('clinicRoute', { 'x-loopwise-clinic-id': 'not-mine' });
		expect(req.clinic).toEqual(CLINIC);
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
		expect(access.listClinicGrants).not.toHaveBeenCalled();
	});
});

describe('@ClinicNonViewer()', () => {
	it.each(['admin', 'user', 'context_admin'] as const)('allows a %s', async (role) => {
		state.staffRoles = ROLES_FOR[role];
		await expect(run('nonViewerRoute')).resolves.toMatchObject({ result: true });
	});

	it('rejects a viewer', async () => {
		state.staffRoles = ROLES_FOR.viewer;
		await expect(run('nonViewerRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Viewers cannot access this resource',
		});
	});
});

describe('@ClinicAdmin()', () => {
	it('allows an admin', async () => {
		state.staffRoles = ROLES_FOR.admin;
		await expect(run('clinicAdminRoute')).resolves.toMatchObject({ result: true });
	});

	it.each(['user', 'viewer', 'context_admin'] as const)('rejects a %s', async (role) => {
		state.staffRoles = ROLES_FOR[role];
		await expect(run('clinicAdminRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Only admins can perform this action',
		});
	});
});

describe('@ClinicAccess({ staffRoles })', () => {
	it('allows a user holding one of the desk roles, and an admin', async () => {
		state.staffRoles = ['CASHIER'];
		await expect(run('cashierDeskRoute')).resolves.toMatchObject({ result: true });
		state.staffRoles = ['ADMIN'];
		await expect(run('cashierDeskRoute')).resolves.toMatchObject({ result: true });
	});

	it('rejects other roles', async () => {
		state.staffRoles = ['NURSE'];
		await expect(run('cashierDeskRoute')).rejects.toMatchObject({ codeMessage: 'FORBIDDEN' });
	});
});

describe('@OrgMember()', () => {
	it('allows a member and sets the organization', async () => {
		const { result, req } = await run('orgMemberRoute');
		expect(result).toBe(true);
		expect(req.organization).toEqual(ORGANIZATION);
		expect(req.orgRole).toBe('MEMBER');
	});

	it('resolves the organization from the selected organization header first', async () => {
		await run('orgMemberRoute', { 'x-loopwise-organization-id': ORG_ID, 'x-loopwise-clinic-id': CLINIC_ID });
		expect(access.listOrganizationGrants).toHaveBeenCalledWith(USER.id, { organizationId: ORG_ID });
		expect(access.listOrganizationGrants).toHaveBeenCalledTimes(1);
	});

	it('falls back to the selected clinic organization', async () => {
		await run('orgMemberRoute', { 'x-loopwise-clinic-id': CLINIC_ID });
		expect(access.listOrganizationGrants).toHaveBeenCalledWith(USER.id, { clinicId: CLINIC_ID });
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
		expect(req.orgRole).toBe('MEMBER');
	});

	it('with strict, allows an admin', async () => {
		state.orgRole = 'ADMIN';
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
