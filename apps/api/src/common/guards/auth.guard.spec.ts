import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { UserRole } from '@quarry/shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthService } from '../../auth/auth.service.js';
import type { OrganizationRepository } from '../../organizations/organization.repository.js';
import type { ProjectRepository } from '../../projects/project.repository.js';
import { OrgAdmin, OrgMember, ProjectAccess, ProjectAdmin, ProjectNonViewer } from '../decorators/access.decorator.js';
import { Public } from '../decorators/public.decorator.js';
import type { QuarryRequest } from '../request.js';
import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';

const USER = { id: 'user-1', email: 'user@example.com' };
const PROJECT = { id: 'project-1', orgId: 'org-1', name: 'Project' };
const ORGANIZATION = { id: 'org-1', name: 'Org' };

class Handlers {
	@Public()
	publicRoute() {}

	protectedRoute() {}

	@ProjectAccess()
	projectRoute() {}

	@ProjectNonViewer()
	nonViewerRoute() {}

	@ProjectAdmin()
	projectAdminRoute() {}

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
	projectRole: 'user' as UserRole | null,
	hasProject: true,
	orgRole: 'user' as string | null,
};

const getSession = vi.fn(async () =>
	state.signedIn ? { user: USER, session: { id: 'session-1', userId: USER.id } } : null,
);

const projects = {
	getProjectByUserId: vi.fn(async () => (state.hasProject && state.projectRole ? PROJECT : null)),
	getUserRoleInProject: vi.fn(async () => state.projectRole),
} as unknown as ProjectRepository;

const organizations = {
	getUserOrgMembership: vi.fn(async () =>
		state.orgRole
			? { orgId: ORGANIZATION.id, userId: USER.id, role: state.orgRole, organization: ORGANIZATION }
			: null,
	),
	getUserOrgMembershipByProject: vi.fn(async () =>
		state.orgRole
			? { orgId: ORGANIZATION.id, userId: USER.id, role: state.orgRole, organization: ORGANIZATION }
			: null,
	),
} as unknown as OrganizationRepository;

const guard = new AuthGuard(
	new Reflector(),
	{ getSession } as unknown as AuthService,
	new AccessService(projects, organizations),
);

function contextFor(route: Route, headers: Record<string, string> = {}) {
	const req = { headers } as unknown as QuarryRequest;
	const context = new ExecutionContextHost([req, {}, () => undefined], Handlers, Handlers.prototype[route]);
	context.setType('http');
	return { req, context: context as unknown as ExecutionContext };
}

async function run(route: Route, headers?: Record<string, string>) {
	const { req, context } = contextFor(route, headers);
	return { result: await guard.canActivate(context), req };
}

beforeEach(() => {
	Object.assign(state, { signedIn: true, projectRole: 'user', hasProject: true, orgRole: 'user' });
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

describe('@ProjectAccess()', () => {
	it.each(['admin', 'user', 'viewer', 'context_admin'] as const)('allows a %s and sets the project', async (role) => {
		state.projectRole = role;
		const { result, req } = await run('projectRoute');
		expect(result).toBe(true);
		expect(req.project).toEqual(PROJECT);
		expect(req.userRole).toBe(role);
	});

	it('passes the selected project header to the lookup', async () => {
		await run('projectRoute', { 'x-quarry-project-id': 'project-1' });
		expect(projects.getProjectByUserId).toHaveBeenCalledWith(USER.id, 'project-1');
	});

	it('rejects users without a project', async () => {
		state.hasProject = false;
		await expect(run('projectRoute')).rejects.toMatchObject({
			codeMessage: 'BAD_REQUEST',
			message: 'No project configured',
		});
	});

	it('rejects anonymous requests before looking up the project', async () => {
		state.signedIn = false;
		await expect(run('projectRoute')).rejects.toMatchObject({ codeMessage: 'UNAUTHORIZED' });
		expect(projects.getProjectByUserId).not.toHaveBeenCalled();
	});
});

describe('@ProjectNonViewer()', () => {
	it.each(['admin', 'user', 'context_admin'] as const)('allows a %s', async (role) => {
		state.projectRole = role;
		await expect(run('nonViewerRoute')).resolves.toMatchObject({ result: true });
	});

	it('rejects a viewer', async () => {
		state.projectRole = 'viewer';
		await expect(run('nonViewerRoute')).rejects.toMatchObject({
			codeMessage: 'FORBIDDEN',
			message: 'Viewers cannot access this resource',
		});
	});
});

describe('@ProjectAdmin()', () => {
	it('allows an admin', async () => {
		state.projectRole = 'admin';
		await expect(run('projectAdminRoute')).resolves.toMatchObject({ result: true });
	});

	it.each(['user', 'viewer', 'context_admin'] as const)('rejects a %s', async (role) => {
		state.projectRole = role;
		await expect(run('projectAdminRoute')).rejects.toMatchObject({
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
		await run('orgMemberRoute', { 'x-quarry-organization-id': 'org-1', 'x-quarry-project-id': 'project-1' });
		expect(organizations.getUserOrgMembership).toHaveBeenCalledWith(USER.id, 'org-1');
		expect(organizations.getUserOrgMembershipByProject).not.toHaveBeenCalled();
	});

	it('falls back to the selected project organization', async () => {
		await run('orgMemberRoute', { 'x-quarry-project-id': 'project-1' });
		expect(organizations.getUserOrgMembershipByProject).toHaveBeenCalledWith(USER.id, 'project-1');
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
		const { req, context } = contextFor('projectRoute');
		await Promise.all([guard.canActivate(context), guard.canActivate(context)]);
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(req.user).toEqual(USER);
	});
});
