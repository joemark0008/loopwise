import type { ExecutionContext } from '@nestjs/common';
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { UserRole } from '@quarry/shared/types';
import type { Request } from 'express';

import type { AuthSession, AuthUser } from '../auth/auth.service.js';
import type { Organization, Project } from '../generated/prisma/client.js';
import type { OrgRole } from '../organizations/organization.repository.js';

/** What the `AuthGuard` attaches to the request, for both REST and GraphQL. */
export interface QuarryRequest extends Request {
	user?: AuthUser;
	session?: AuthSession['session'];
	/** Set by `@ProjectAccess()` / `@ProjectAdmin()`. */
	project?: Project;
	userRole?: UserRole;
	/** Set by `@OrgMember()` / `@OrgAdmin()`. */
	organization?: Organization;
	orgRole?: OrgRole;
	/** Set by `@FacilityKey()`: the organization whose facility key authenticated the request. */
	facility?: Organization;
}

/** The Express request behind a REST handler or a GraphQL resolver. */
export function getRequest(context: ExecutionContext): QuarryRequest {
	if (context.getType<GqlContextType>() === 'graphql') {
		return GqlExecutionContext.create(context).getContext<{ req: QuarryRequest }>().req;
	}
	return context.switchToHttp().getRequest<QuarryRequest>();
}

/** GraphQL resolver arguments (empty for REST). */
export function getArgs(context: ExecutionContext): Record<string, unknown> {
	if (context.getType<GqlContextType>() === 'graphql') {
		return GqlExecutionContext.create(context).getArgs<Record<string, unknown>>();
	}
	return {};
}
