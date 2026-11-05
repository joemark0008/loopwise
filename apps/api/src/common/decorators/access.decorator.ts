import type { UserRole } from '@loopwise/shared/types';
import { SetMetadata } from '@nestjs/common';

export const ACCESS_KEY = 'loopwise:access';

export type AccessRequirement =
	{ kind: 'clinic'; roles?: readonly UserRole[] } | { kind: 'organization'; adminOnly: boolean };

export interface ClinicAccessOptions {
	/** Roles allowed in the clinic. Default: any member (upstream `clinicProtectedProcedure`). */
	roles?: readonly UserRole[];
}

/**
 * Resolves the selected clinic (`clinicId` argument or `x-loopwise-clinic-id` header) and requires a role
 * in it. Sets `request.clinic` and `request.userRole` (`@CurrentClinic()`, `@CurrentUserRole()`).
 */
export const ClinicAccess = (options: ClinicAccessOptions = {}) =>
	SetMetadata<string, AccessRequirement>(ACCESS_KEY, { kind: 'clinic', roles: options.roles });

/** Clinic admins only (upstream `adminProtectedProcedure`). */
export const ClinicAdmin = () => ClinicAccess({ roles: ['admin'] });

/** Admins, users and context admins: not viewers (upstream `nonViewerProtectedProcedure`). */
export const ClinicNonViewer = () => ClinicAccess({ roles: ['admin', 'user', 'context_admin'] });

/**
 * Resolves the user's organization (`x-loopwise-organization-id` header, else the selected clinic's, else the
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
