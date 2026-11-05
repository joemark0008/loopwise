import type { StaffRole as ClinicStaffRole } from '@loopwise/shared/staff-roles';
import type { StaffRole } from '@/lib/navigation';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

/**
 * The desk each clinic role works at, in the order that picks a user's own desk when they hold several roles: a doctor
 * who is also the clinic's admin stays a doctor.
 */
const DESK_BY_CLINIC_ROLE: readonly (readonly [ClinicStaffRole, StaffRole])[] = [
	['DOCTOR', 'doctor'],
	['NURSE', 'nurse'],
	['MIDWIFE', 'nurse'],
	['MEDTECH', 'lab'],
	['RADTECH', 'lab'],
	['RECEPTIONIST', 'front_desk'],
	['CASHIER', 'cashier'],
	['BILLING_CLERK', 'cashier'],
];

/** Every desk, in sidebar order: what a clinic admin can open. */
export const ALL_DESKS: readonly StaffRole[] = ['doctor', 'nurse', 'lab', 'front_desk', 'cashier'];

/**
 * The desks a user works at from their roles at the clinic (`currentClinic.staffRoles`), own desk first. Admins
 * (SUPER_ADMIN / ADMIN) can open every desk. A user with no desk role (a MEMBER, a pharmacist until the pharmacy desk
 * exists) works as a doctor, as everyone did before the API had roles.
 */
export function desksOf(staffRoles: readonly string[]): StaffRole[] {
	const own = DESK_BY_CLINIC_ROLE.filter(([role]) => staffRoles.includes(role)).map(([, desk]) => desk);
	const isAdmin = staffRoles.includes('SUPER_ADMIN') || staffRoles.includes('ADMIN');
	const desks = [...own, ...(isAdmin ? ALL_DESKS : [])];
	return desks.length > 0 ? [...new Set(desks)] : ['doctor'];
}

/** The user's own desk: the first of `desksOf`. */
export function staffRoleOf(staffRoles: readonly string[]): StaffRole {
	return desksOf(staffRoles)[0];
}

/**
 * The signed-in user's role in the loop (DESIGN.md §1), which picks their home and sidebar: from their roles at the
 * selected clinic (MEDTECH / RADTECH → lab, NURSE / MIDWIFE → nurse, RECEPTIONIST → front desk, CASHIER /
 * BILLING_CLERK → cashier, DOCTOR → doctor).
 */
export function useStaffRole(): StaffRole {
	return staffRoleOf(useCurrentClinic().data?.staffRoles ?? []);
}

/** Every desk the signed-in user can open at the selected clinic, own desk first (admins: every desk). */
export function useDesks(): StaffRole[] {
	return desksOf(useCurrentClinic().data?.staffRoles ?? []);
}
