import type { StaffRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import { SetMetadata } from '@nestjs/common';

export const ACCESS_KEY = 'loopwise:access';

export type AccessRequirement =
	| { kind: 'clinic'; roles?: readonly UserRole[]; staffRoles?: readonly StaffRole[] }
	| { kind: 'organization'; adminOnly: boolean };

export interface ClinicAccessOptions {
	/** Access levels allowed in the clinic. Default: any (upstream `clinicProtectedProcedure`). */
	roles?: readonly UserRole[];
	/**
	 * A desk: the user must hold one of these clinic roles (e.g. `['CASHIER', 'BILLING_CLERK']`); clinic admins
	 * (`userRole` admin) always pass. Checked after `roles`.
	 */
	staffRoles?: readonly StaffRole[];
}

/**
 * Resolves the selected clinic (`clinicId` argument or `x-loopwise-clinic-id` header) and requires access to it.
 * Sets `request.clinic`, `request.userRole` and `request.staffRoles` (`@CurrentClinic()`, `@CurrentUserRole()`,
 * `@CurrentStaffRoles()`). The access level comes from `user_clinic_roles` + `organization_members` through
 * `toUserRole` (`@loopwise/shared/staff-roles`).
 */
export const ClinicAccess = (options: ClinicAccessOptions = {}) =>
	SetMetadata<string, AccessRequirement>(ACCESS_KEY, {
		kind: 'clinic',
		roles: options.roles,
		staffRoles: options.staffRoles,
	});

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
