import type { StaffRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import { getRequest } from '../../common/request.js';

/** Who drafts and issues a visit's invoice: the doctor who drafts the charges, and the billing desk. */
export const INVOICE_DRAFT_ROLES = ['DOCTOR', 'CASHIER', 'BILLING_CLERK'] as const satisfies readonly StaffRole[];
/** Who takes payments and voids invoices: the cashier and billing desk. */
export const INVOICE_COLLECT_ROLES = ['CASHIER', 'BILLING_CLERK'] as const satisfies readonly StaffRole[];

/** The user working a billing desk: the clinic `@ClinicAccess()` resolved, and their roles there. */
export interface BillingActor {
	userId: string;
	clinicId: string;
	userRole: UserRole | null;
	staffRoles: readonly StaffRole[];
}

/** Clinic admins pass every desk check (as `@ClinicAccess({ staffRoles })` does). */
export function holdsBillingRole(actor: BillingActor, roles: readonly StaffRole[]): boolean {
	return actor.userRole === 'admin' || actor.staffRoles.some((role) => roles.includes(role));
}

/**
 * The `BillingActor` of a handler under `@ClinicAccess()`: the signed-in user, the clinic resolved and their roles
 * there.
 */
export const CurrentBillingActor = createParamDecorator((_data: unknown, context: ExecutionContext): BillingActor => {
	const req = getRequest(context);
	if (!req.user || !req.clinic) {
		throw new HandlerError('UNAUTHORIZED', 'Unauthorized');
	}
	return {
		userId: req.user.id,
		clinicId: req.clinic.id,
		userRole: req.userRole ?? null,
		staffRoles: req.staffRoles ?? [],
	};
});
