import type { UserRole } from '@loopwise/shared/types';
import type { ExecutionContext } from '@nestjs/common';
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

import type { AuthSession, AuthUser } from '../auth/auth.service.js';
import type { Clinic, Organization, OrgRole, StaffRole } from '../generated/prisma/client.js';

/** What the `AuthGuard` attaches to the request, for both REST and GraphQL. */
export interface LoopwiseRequest extends Request {
	user?: AuthUser;
	session?: AuthSession['session'];
	/** Set by `@ClinicAccess()` / `@ClinicAdmin()`. */
	clinic?: Clinic;
	/** The access level derived from the user's roles (`toUserRole`, `@loopwise/shared/staff-roles`). */
	userRole?: UserRole;
	/** The user's roles at `clinic` (`user_clinic_roles`), for desk-specific checks. */
	staffRoles?: StaffRole[];
	/** Set by `@OrgMember()` / `@OrgAdmin()`. */
	organization?: Organization;
	/** The user's `organization_members` role (MEMBER / VIEWER when they only hold clinic roles there). */
	orgRole?: OrgRole;
}

/** The Express request behind a REST handler or a GraphQL resolver. */
export function getRequest(context: ExecutionContext): LoopwiseRequest {
	if (context.getType<GqlContextType>() === 'graphql') {
		return GqlExecutionContext.create(context).getContext<{ req: LoopwiseRequest }>().req;
	}
	return context.switchToHttp().getRequest<LoopwiseRequest>();
}

/** GraphQL resolver arguments (empty for REST). */
export function getArgs(context: ExecutionContext): Record<string, unknown> {
	if (context.getType<GqlContextType>() === 'graphql') {
		return GqlExecutionContext.create(context).getArgs<Record<string, unknown>>();
	}
	return {};
}
