import { toUserRole } from '@loopwise/shared/staff-roles';
import type { UserRole } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/config.service.js';
import type { Clinic, Organization, OrgRole, StaffRole } from '../../generated/prisma/client.js';
import { HandlerError } from '../errors/handler-error.js';
import { isUuid } from '../uuid.js';
import { AccessRepository, type ClinicGrant, type OrganizationGrant } from './access.repository.js';

/** A clinic the user can open, with the access level the guards check and the roles behind it. */
export interface ClinicAccessGrant {
	clinic: Clinic;
	userRole: UserRole;
	staffRoles: StaffRole[];
}

/** The organization a request works on and the user's role in it. */
export interface OrganizationMembership {
	organization: Organization;
	/**
	 * The `organization_members` role; a user with only clinic roles in the organization counts as MEMBER (VIEWER when
	 * they only hold VIEWER).
	 */
	role: OrgRole;
	staffRoles: StaffRole[];
}

/**
 * Access checks behind the guard decorators (upstream `trpc/trpc.ts` procedure middlewares), on `user_clinic_roles` and
 * `organization_members`; the access level is `toUserRole` of `@loopwise/shared/staff-roles`. Exported for the modules
 * that list a user's clinics or need their level at a given clinic.
 */
@Injectable()
export class AccessService {
	constructor(
		private readonly access: AccessRepository,
		private readonly config: ConfigService,
	) {}

	/** Every clinic the user can open, by name, with their access level there. */
	async listUserClinics(userId: string): Promise<ClinicAccessGrant[]> {
		return (await this.access.listClinicGrants(userId)).flatMap((grant) => toClinicAccess(grant) ?? []);
	}

	/** The user's access level at `clinicId`, or null when they have none. */
	async getUserRoleInClinic(clinicId: string, userId: string): Promise<UserRole | null> {
		if (!isUuid(clinicId)) {
			return null;
		}
		const grant = await this.access.getClinicGrant(userId, clinicId);
		return grant ? (toClinicAccess(grant)?.userRole ?? null) : null;
	}

	/**
	 * The clinic a request works on (`clinicProtectedProcedure` plus the admin / non-viewer role checks): the selected
	 * clinic when the user can open it, else the default clinic (`LOOPWISE_DEFAULT_CLINIC_PATH`, else the oldest) when
	 * they can, else their first clinic.
	 */
	async resolveClinicAccess(
		userId: string,
		selectedClinicId: string | null,
		roles?: readonly UserRole[],
	): Promise<ClinicAccessGrant> {
		const grant = await this.findClinicAccess(userId, selectedClinicId);
		if (!grant) {
			throw new HandlerError('BAD_REQUEST', 'No clinic configured');
		}
		if (roles && !roles.includes(grant.userRole)) {
			throw new HandlerError(
				'FORBIDDEN',
				roles.length === 1 && roles[0] === 'admin'
					? 'Only admins can perform this action'
					: 'Viewers cannot access this resource',
			);
		}
		return grant;
	}

	/** The clinic `resolveClinicAccess` picks, without its role check; null when the user can open no clinic. */
	async findClinicAccess(userId: string, selectedClinicId: string | null): Promise<ClinicAccessGrant | null> {
		const grants = await this.listUserClinics(userId);
		return (
			grants.find(({ clinic }) => clinic.id === selectedClinicId) ??
			(await this.defaultClinicGrant(grants)) ??
			grants[0] ??
			null
		);
	}

	/**
	 * The organization a request works on (`resolveOrganizationMembership`): the selected organization, else the
	 * selected clinic's, else the user's oldest membership.
	 */
	async resolveOrganizationMembership(
		userId: string,
		selectedClinicId: string | null,
		selectedOrganizationId: string | null,
	): Promise<OrganizationMembership> {
		if (selectedOrganizationId) {
			const [grant] = isUuid(selectedOrganizationId)
				? await this.access.listOrganizationGrants(userId, { organizationId: selectedOrganizationId })
				: [];
			return toMembership(grant, 'You are not a member of any organization');
		}
		if (selectedClinicId) {
			const [grant] = isUuid(selectedClinicId)
				? await this.access.listOrganizationGrants(userId, { clinicId: selectedClinicId })
				: [];
			return toMembership(grant, 'Selected clinic organization was not found');
		}
		const [grant] = await this.access.listOrganizationGrants(userId);
		return toMembership(grant, 'You are not a member of any organization');
	}

	private async defaultClinicGrant(grants: ClinicAccessGrant[]): Promise<ClinicAccessGrant | undefined> {
		const path = this.config.env.LOOPWISE_DEFAULT_CLINIC_PATH;
		const defaultClinic = path ? await this.access.getClinicByPath(path) : await this.access.getFirstClinic();
		return defaultClinic ? grants.find(({ clinic }) => clinic.id === defaultClinic.id) : undefined;
	}
}

function toClinicAccess({ clinic, staffRoles, orgRole }: ClinicGrant): ClinicAccessGrant | null {
	const userRole = toUserRole(staffRoles, orgRole);
	return userRole ? { clinic, userRole, staffRoles } : null;
}

function toMembership(grant: OrganizationGrant | undefined, notFound: string): OrganizationMembership {
	if (!grant) {
		throw new HandlerError('NOT_FOUND', notFound);
	}
	const { organization, orgRole, staffRoles } = grant;
	const role = orgRole ?? (staffRoles.every((r) => r === 'VIEWER') ? 'VIEWER' : 'MEMBER');
	return { organization, role, staffRoles };
}
