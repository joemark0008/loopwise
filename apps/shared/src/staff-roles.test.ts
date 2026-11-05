import { describe, expect, it } from 'vitest';

import {
	isStaffRole,
	ORG_ROLE_BY_USER_ROLE,
	ORG_ROLES,
	orgRoleToUserRole,
	STAFF_ROLE_BY_USER_ROLE,
	STAFF_ROLE_LABELS,
	STAFF_ROLES,
	toUserRole,
} from './staff-roles';

describe('toUserRole', () => {
	it('makes any super admin or admin an admin, whatever else they hold', () => {
		expect(toUserRole(['SUPER_ADMIN'])).toBe('admin');
		expect(toUserRole(['DOCTOR', 'ADMIN', 'VIEWER'])).toBe('admin');
		expect(toUserRole(['CONTEXT_ADMIN', 'SUPER_ADMIN'])).toBe('admin');
	});

	it('makes a context admin a context admin when they are not an admin', () => {
		expect(toUserRole(['CONTEXT_ADMIN'])).toBe('context_admin');
		expect(toUserRole(['NURSE', 'CONTEXT_ADMIN'])).toBe('context_admin');
	});

	it('makes every desk role and MEMBER a user', () => {
		for (const role of STAFF_ROLES.filter(
			(r) => !['SUPER_ADMIN', 'ADMIN', 'CONTEXT_ADMIN', 'VIEWER'].includes(r),
		)) {
			expect(toUserRole([role])).toBe('user');
		}
		expect(toUserRole(['VIEWER', 'CASHIER'])).toBe('user');
	});

	it('leaves only viewers as viewers, and no roles as no access', () => {
		expect(toUserRole(['VIEWER'])).toBe('viewer');
		expect(toUserRole([])).toBeNull();
		expect(toUserRole([], null)).toBeNull();
	});

	it('counts the organization role: an organization admin administers every clinic of it', () => {
		expect(toUserRole([], 'ADMIN')).toBe('admin');
		expect(toUserRole(['VIEWER'], 'ADMIN')).toBe('admin');
		expect(toUserRole([], 'MEMBER')).toBe('user');
		expect(toUserRole(['VIEWER'], 'MEMBER')).toBe('user');
		expect(toUserRole([], 'VIEWER')).toBe('viewer');
		expect(toUserRole(['CONTEXT_ADMIN'], 'VIEWER')).toBe('context_admin');
	});
});

describe('role tables', () => {
	it('labels every staff role and round-trips the access levels', () => {
		expect(Object.keys(STAFF_ROLE_LABELS).sort()).toEqual([...STAFF_ROLES].sort());
		for (const [userRole, staffRole] of Object.entries(STAFF_ROLE_BY_USER_ROLE)) {
			expect(toUserRole([staffRole])).toBe(userRole);
		}
		for (const [userRole, orgRole] of Object.entries(ORG_ROLE_BY_USER_ROLE)) {
			expect(orgRoleToUserRole(orgRole)).toBe(userRole);
			expect(toUserRole([], orgRole)).toBe(userRole);
		}
		expect(ORG_ROLES).toHaveLength(3);
	});

	it('recognises staff roles', () => {
		expect(isStaffRole('MEDTECH')).toBe(true);
		expect(isStaffRole('admin')).toBe(false);
		expect(isStaffRole(undefined)).toBe(false);
	});
});
