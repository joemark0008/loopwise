import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../../auth/auth.service.js';
import { ACCESS_KEY, type AccessRequirement } from '../decorators/access.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { HandlerError } from '../errors/handler-error.js';
import { getArgs, getRequest, type QuarryRequest } from '../request.js';
import { convertHeaders } from '../utils/auth-utils.js';
import { AccessService } from './access.service.js';

const PROJECT_HEADER = 'x-quarry-project-id';
const ORGANIZATION_HEADER = 'x-quarry-organization-id';

/** One session lookup per request: GraphQL runs the guard once per resolver, possibly in parallel. */
const sessionLookups = new WeakMap<object, Promise<void>>();

/**
 * Global guard. Every handler requires a session unless marked `@Public()` (upstream
 * `protectedProcedure` by default); the access decorators add project or organization checks.
 */
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly auth: AuthService,
		private readonly access: AccessService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const targets = [context.getHandler(), context.getClass()];
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ?? false;
		const requirement = this.reflector.getAllAndOverride<AccessRequirement | undefined>(ACCESS_KEY, targets);
		const req = getRequest(context);

		let lookup = sessionLookups.get(req);
		if (!lookup) {
			lookup = this.attachSession(req);
			sessionLookups.set(req, lookup);
		}
		await lookup;

		if (isPublic) {
			return true;
		}
		if (!req.user) {
			throw new HandlerError('UNAUTHORIZED', 'Unauthorized');
		}
		if (!requirement) {
			return true;
		}

		const selectedProjectId = readSelection(getArgs(context).projectId) ?? readHeader(req.headers[PROJECT_HEADER]);
		if (requirement.kind === 'project') {
			const { project, userRole } = await this.access.resolveProjectAccess(
				req.user.id,
				selectedProjectId,
				requirement.roles,
			);
			req.project = project;
			req.userRole = userRole;
			return true;
		}

		const membership = await this.access.resolveOrganizationMembership(
			req.user.id,
			selectedProjectId,
			readHeader(req.headers[ORGANIZATION_HEADER]),
		);
		if (requirement.adminOnly && membership.role !== 'admin') {
			throw new HandlerError('FORBIDDEN', 'Only organization admins can perform this action');
		}
		req.organization = membership.organization;
		req.orgRole = membership.role as typeof req.orgRole;
		return true;
	}

	private async attachSession(req: QuarryRequest): Promise<void> {
		if (req.user) {
			return;
		}
		const session = await this.auth.getSession(convertHeaders(req.headers));
		if (session?.user) {
			req.user = session.user;
			req.session = session.session;
		}
	}
}

function readSelection(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function readHeader(value: string | string[] | undefined): string | null {
	return readSelection(Array.isArray(value) ? value[0] : value);
}
