import type { StaffRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import { getRequest } from '../../common/request.js';

/**
 * Who changes the clinic's setup: the signed-in user and the clinic `@ClinicAdmin()` resolved (an ADMIN or
 * SUPER_ADMIN there, or an ADMIN of its organization). Setup writes that row-level security gives no admin path for
 * (the organization and clinic rows, another practitioner's profile, deletes) run as system work, scoped by these ids.
 */
export interface ClinicActor {
	userId: string;
	clinicId: string;
	clinicCode: string;
	organizationId: string;
	userRole: UserRole | null;
	staffRoles: readonly StaffRole[];
}

/** The `ClinicActor` of a handler under `@ClinicAccess()` / `@ClinicAdmin()`. */
export const CurrentClinicActor = createParamDecorator((_data: unknown, context: ExecutionContext): ClinicActor => {
	const req = getRequest(context);
	if (!req.user || !req.clinic) {
		throw new HandlerError('UNAUTHORIZED', 'Unauthorized');
	}
	return {
		userId: req.user.id,
		clinicId: req.clinic.id,
		clinicCode: req.clinic.code,
		organizationId: req.clinic.organizationId,
		userRole: req.userRole ?? null,
		staffRoles: req.staffRoles ?? [],
	};
});
