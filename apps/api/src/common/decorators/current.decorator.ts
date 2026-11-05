import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { getRequest } from '../request.js';

/** The signed-in user (the global `AuthGuard` guarantees one outside `@Public()` handlers). */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).user,
);

/** The session of the signed-in user. */
export const CurrentSession = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).session,
);

/** The clinic resolved by `@ClinicAccess()`. */
export const CurrentClinic = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).clinic,
);

/** The user's role in the clinic resolved by `@ClinicAccess()`. */
export const CurrentUserRole = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).userRole,
);

/** The user's staff roles in the clinic resolved by `@ClinicAccess()` (e.g. DOCTOR, CASHIER). */
export const CurrentStaffRoles = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).staffRoles ?? [],
);

/** The organization resolved by `@OrgMember()` / `@OrgAdmin()`. */
export const CurrentOrganization = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).organization,
);

/** The user's role (`OrgRole`: ADMIN / MEMBER / VIEWER) in the organization resolved by `@OrgMember()` / `@OrgAdmin()`. */
export const CurrentOrgRole = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).orgRole,
);

/** The clinic id the client selected (`x-loopwise-clinic-id` header), for handlers without `@ClinicAccess()`. */
export const SelectedClinicId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
	const value = getRequest(context).headers['x-loopwise-clinic-id'];
	const id = Array.isArray(value) ? value[0] : value;
	return id && id.trim() ? id.trim() : null;
});
