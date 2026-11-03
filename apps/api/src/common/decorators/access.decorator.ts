import type { UserRole } from '@loopwise/shared/types';
import { SetMetadata } from '@nestjs/common';

export const ACCESS_KEY = 'loopwise:access';

export type AccessRequirement =
	{ kind: 'project'; roles?: readonly UserRole[] } | { kind: 'organization'; adminOnly: boolean };

export interface ProjectAccessOptions {
	/** Roles allowed in the project. Default: any member (upstream `projectProtectedProcedure`). */
	roles?: readonly UserRole[];
}

/**
 * Resolves the selected project (`projectId` argument or `x-loopwise-project-id` header) and requires a role
 * in it. Sets `request.project` and `request.userRole` (`@CurrentProject()`, `@CurrentUserRole()`).
 */
export const ProjectAccess = (options: ProjectAccessOptions = {}) =>
	SetMetadata<string, AccessRequirement>(ACCESS_KEY, { kind: 'project', roles: options.roles });

/** Project admins only (upstream `adminProtectedProcedure`). */
export const ProjectAdmin = () => ProjectAccess({ roles: ['admin'] });

/** Admins, users and context admins: not viewers (upstream `nonViewerProtectedProcedure`). */
export const ProjectNonViewer = () => ProjectAccess({ roles: ['admin', 'user', 'context_admin'] });

/**
 * Resolves the user's organization (`x-loopwise-organization-id` header, else the selected project's, else the
 * oldest membership). Sets `request.organization` and `request.orgRole` (`@CurrentOrganization()`).
 */
export const OrgMember = () =>
	SetMetadata<string, AccessRequirement>(ACCESS_KEY, { kind: 'organization', adminOnly: false });

/**
 * Organization admins. Upstream's `orgAdminProcedure` only resolves the organization and lets the handler
 * check the role; `{ strict: true }` (`orgAdminOnlyProcedure`) rejects non-admins in the guard.
 */
export const OrgAdmin = (options: { strict?: boolean } = {}) =>
	SetMetadata<string, AccessRequirement>(ACCESS_KEY, { kind: 'organization', adminOnly: options.strict ?? false });
