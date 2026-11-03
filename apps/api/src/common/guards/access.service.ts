import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import type { Project } from '../../generated/prisma/client.js';
import { OrganizationRepository, type UserOrgMembership } from '../../organizations/organization.repository.js';
import { ProjectRepository } from '../../projects/project.repository.js';
import { HandlerError } from '../errors/handler-error.js';

/** Access checks behind the guard decorators (upstream `trpc/trpc.ts` procedure middlewares). */
@Injectable()
export class AccessService {
	constructor(
		private readonly projects: ProjectRepository,
		private readonly organizations: OrganizationRepository,
	) {}

	/** `projectProtectedProcedure`, plus the role checks of the admin / non-viewer procedures. */
	async resolveProjectAccess(
		userId: string,
		selectedProjectId: string | null,
		roles?: readonly UserRole[],
	): Promise<{ project: Project; userRole: UserRole }> {
		const project = await this.projects.getProjectByUserId(userId, selectedProjectId);
		if (!project) {
			throw new HandlerError('BAD_REQUEST', 'No project configured');
		}
		const userRole = await this.projects.getUserRoleInProject(project.id, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this project.');
		}
		if (roles && !roles.includes(userRole)) {
			throw new HandlerError(
				'FORBIDDEN',
				roles.length === 1 && roles[0] === 'admin'
					? 'Only admins can perform this action'
					: 'Viewers cannot access this resource',
			);
		}
		return { project, userRole };
	}

	/** `resolveOrganizationMembership`. */
	async resolveOrganizationMembership(
		userId: string,
		selectedProjectId: string | null,
		selectedOrganizationId: string | null,
	): Promise<UserOrgMembership> {
		if (selectedOrganizationId) {
			const membership = await this.organizations.getUserOrgMembership(userId, selectedOrganizationId);
			if (!membership) {
				throw new HandlerError('NOT_FOUND', 'You are not a member of any organization');
			}
			return membership;
		}

		if (selectedProjectId) {
			const membership = await this.organizations.getUserOrgMembershipByProject(userId, selectedProjectId);
			if (!membership) {
				throw new HandlerError('NOT_FOUND', 'Selected project organization was not found');
			}
			return membership;
		}

		const membership = await this.organizations.getUserOrgMembership(userId);
		if (!membership) {
			throw new HandlerError('NOT_FOUND', 'You are not a member of any organization');
		}
		return membership;
	}
}
