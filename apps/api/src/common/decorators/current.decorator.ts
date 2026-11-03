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

/** The project resolved by `@ProjectAccess()`. */
export const CurrentProject = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).project,
);

/** The user's role in the project resolved by `@ProjectAccess()`. */
export const CurrentUserRole = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).userRole,
);

/** The organization resolved by `@OrgMember()` / `@OrgAdmin()`. */
export const CurrentOrganization = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).organization,
);

/** The user's role in the organization resolved by `@OrgMember()` / `@OrgAdmin()`. */
export const CurrentOrgRole = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).orgRole,
);

/** The facility (organization) authenticated by `@FacilityKey()`. */
export const CurrentFacility = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => getRequest(context).facility,
);

/** The project id the client selected (`x-loopwise-project-id` header), for handlers without `@ProjectAccess()`. */
export const SelectedProjectId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
	const value = getRequest(context).headers['x-loopwise-project-id'];
	const id = Array.isArray(value) ? value[0] : value;
	return id && id.trim() ? id.trim() : null;
});
