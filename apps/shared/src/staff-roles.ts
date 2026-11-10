import type { UserRole } from './types';

/**
 * A user's roles at a clinic (`user_clinic_roles.role`, the Prisma enum `StaffRole`): the base schema's staff roles
 * plus Loopwise's MEMBER (staff without a specific desk), VIEWER (read-only) and CONTEXT_ADMIN (manages Wise's context
 * files). A user holds one row per role, e.g. SUPER_ADMIN + ADMIN + DOCTOR.
 */
export const STAFF_ROLES = [
	'SUPER_ADMIN',
	'ADMIN',
	'DOCTOR',
	'NURSE',
	'MIDWIFE',
	'RECEPTIONIST',
	'CASHIER',
	'BILLING_CLERK',
	'PHARMACIST',
	'PHARMACY_ASSISTANT',
	'MEDTECH',
	'RADTECH',
	'INVENTORY_CLERK',
	'MEMBER',
	'VIEWER',
	'CONTEXT_ADMIN',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
	SUPER_ADMIN: 'Super admin',
	ADMIN: 'Admin',
	DOCTOR: 'Doctor',
	NURSE: 'Nurse',
	MIDWIFE: 'Midwife',
	RECEPTIONIST: 'Front desk',
	CASHIER: 'Cashier',
	BILLING_CLERK: 'Billing clerk',
	PHARMACIST: 'Pharmacist',
	PHARMACY_ASSISTANT: 'Pharmacy assistant',
	MEDTECH: 'Medical technologist',
	RADTECH: 'Radiologic technologist',
	INVENTORY_CLERK: 'Inventory clerk',
	MEMBER: 'Member',
	VIEWER: 'Viewer',
	CONTEXT_ADMIN: 'Context admin',
};

/** A user's level in an organization (`organization_members.role`, the Prisma enum `OrgRole`). */
export const ORG_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
	ADMIN: 'Admin',
	MEMBER: 'Member',
	VIEWER: 'Viewer',
};

export function isStaffRole(value: unknown): value is StaffRole {
	return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * The app's access level at a clinic (`UserRole`, what `@ClinicAdmin()` / `@ClinicNonViewer()` check), derived from the
 * user's roles there and their role in the clinic's organization (an organization admin manages every clinic of it):
 * any SUPER_ADMIN or ADMIN → `admin`; else CONTEXT_ADMIN → `context_admin`; else any role other than VIEWER → `user`;
 * else `viewer`. `null` when the user holds no role at all (no access).
 */
export function toUserRole(staffRoles: readonly StaffRole[], orgRole?: OrgRole | null): UserRole | null {
	const roles = new Set<StaffRole>(staffRoles);
	if (orgRole) {
		roles.add(orgRole);
	}
	if (roles.size === 0) {
		return null;
	}
	if (roles.has('SUPER_ADMIN') || roles.has('ADMIN')) {
		return 'admin';
	}
	if (roles.has('CONTEXT_ADMIN')) {
		return 'context_admin';
	}
	return [...roles].some((role) => role !== 'VIEWER') ? 'user' : 'viewer';
}

/**
 * The clinic roles that give a user `userRole`, for screens that still pick one access level (inviting a member,
 * changing a member's level): `admin` → ADMIN, `context_admin` → CONTEXT_ADMIN, `user` → MEMBER, `viewer` → VIEWER.
 */
export const STAFF_ROLE_BY_USER_ROLE: Record<UserRole, StaffRole> = {
	admin: 'ADMIN',
	context_admin: 'CONTEXT_ADMIN',
	user: 'MEMBER',
	viewer: 'VIEWER',
};

/** The organization role for an organization-level access level (`context_admin` is a clinic role only). */
export const ORG_ROLE_BY_USER_ROLE: Record<Exclude<UserRole, 'context_admin'>, OrgRole> = {
	admin: 'ADMIN',
	user: 'MEMBER',
	viewer: 'VIEWER',
};

/** The access level an organization role alone gives (`toUserRole([], orgRole)`). */
export function orgRoleToUserRole(orgRole: OrgRole): Exclude<UserRole, 'context_admin'> {
	return orgRole === 'ADMIN' ? 'admin' : orgRole === 'MEMBER' ? 'user' : 'viewer';
}
