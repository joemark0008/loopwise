import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { ClinicRepository } from '../../clinics/clinic.repository.js';
import type { Clinic } from '../../generated/prisma/client.js';
import { OrganizationRepository, type UserOrgMembership } from '../../organizations/organization.repository.js';
import { HandlerError } from '../errors/handler-error.js';

/** Access checks behind the guard decorators (upstream `trpc/trpc.ts` procedure middlewares). */
@Injectable()
export class AccessService {
	constructor(
		private readonly clinics: ClinicRepository,
		private readonly organizations: OrganizationRepository,
	) {}

	/** `clinicProtectedProcedure`, plus the role checks of the admin / non-viewer procedures. */
	async resolveClinicAccess(
		userId: string,
		selectedClinicId: string | null,
		roles?: readonly UserRole[],
	): Promise<{ clinic: Clinic; userRole: UserRole }> {
		const clinic = await this.clinics.getClinicByUserId(userId, selectedClinicId);
		if (!clinic) {
			throw new HandlerError('BAD_REQUEST', 'No clinic configured');
		}
		const userRole = await this.clinics.getUserRoleInClinic(clinic.id, userId);
		if (!userRole) {
			throw new HandlerError('FORBIDDEN', 'You do not have access to this clinic.');
		}
		if (roles && !roles.includes(userRole)) {
			throw new HandlerError(
				'FORBIDDEN',
				roles.length === 1 && roles[0] === 'admin'
					? 'Only admins can perform this action'
					: 'Viewers cannot access this resource',
			);
		}
		return { clinic, userRole };
	}

	/** `resolveOrganizationMembership`. */
	async resolveOrganizationMembership(
		userId: string,
		selectedClinicId: string | null,
		selectedOrganizationId: string | null,
	): Promise<UserOrgMembership> {
		if (selectedOrganizationId) {
			const membership = await this.organizations.getUserOrgMembership(userId, selectedOrganizationId);
			if (!membership) {
				throw new HandlerError('NOT_FOUND', 'You are not a member of any organization');
			}
			return membership;
		}

		if (selectedClinicId) {
			const membership = await this.organizations.getUserOrgMembershipByClinic(userId, selectedClinicId);
			if (!membership) {
				throw new HandlerError('NOT_FOUND', 'Selected clinic organization was not found');
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
