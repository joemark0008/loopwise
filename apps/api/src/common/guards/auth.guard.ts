import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../../auth/auth.service.js';
import { ACCESS_KEY, type AccessRequirement } from '../decorators/access.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { HandlerError } from '../errors/handler-error.js';
import { getArgs, getRequest, type LoopwiseRequest } from '../request.js';
import { currentRequestContext, getRequestContext } from '../request-context.js';
import { convertHeaders } from '../utils/auth-utils.js';
import { AccessService } from './access.service.js';

const CLINIC_HEADER = 'x-loopwise-clinic-id';
const ORGANIZATION_HEADER = 'x-loopwise-organization-id';

/** One session lookup per request: GraphQL runs the guard once per resolver, possibly in parallel. */
const sessionLookups = new WeakMap<object, Promise<void>>();

/**
 * Global guard. Every handler requires a session unless marked `@Public()` (upstream
 * `protectedProcedure` by default); the access decorators add clinic or organization checks.
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

		const selectedClinicId = readSelection(getArgs(context).clinicId) ?? readHeader(req.headers[CLINIC_HEADER]);
		if (requirement.kind === 'clinic') {
			const { clinic, userRole, staffRoles } = await this.access.resolveClinicAccess(
				req.user.id,
				selectedClinicId,
				requirement.roles,
			);
			if (
				requirement.staffRoles &&
				userRole !== 'admin' &&
				!staffRoles.some((role) => requirement.staffRoles?.includes(role))
			) {
				throw new HandlerError('FORBIDDEN', 'Your role at this clinic does not allow this action.');
			}
			req.clinic = clinic;
			req.userRole = userRole;
			req.staffRoles = staffRoles;
			return true;
		}

		const membership = await this.access.resolveOrganizationMembership(
			req.user.id,
			selectedClinicId,
			readHeader(req.headers[ORGANIZATION_HEADER]),
		);
		if (requirement.adminOnly && membership.role !== 'ADMIN') {
			throw new HandlerError('FORBIDDEN', 'Only organization admins can perform this action');
		}
		req.organization = membership.organization;
		req.orgRole = membership.role;
		return true;
	}

	private async attachSession(req: LoopwiseRequest): Promise<void> {
		if (req.user) {
			return;
		}
		const session = await this.auth.getSession(convertHeaders(req.headers));
		if (session?.user) {
			req.user = session.user;
			req.session = session.session;
			// For the logs; the audit trail takes the user explicitly.
			const context = getRequestContext(req) ?? currentRequestContext();
			if (context) {
				context.userId = session.user.id;
			}
		}
	}
}

function readSelection(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function readHeader(value: string | string[] | undefined): string | null {
	return readSelection(Array.isArray(value) ? value[0] : value);
}
