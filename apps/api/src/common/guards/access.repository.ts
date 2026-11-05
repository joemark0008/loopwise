import { Injectable } from '@nestjs/common';

import type { Clinic, Organization, OrgRole, StaffRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** A clinic the user reaches, with their roles there and their role in its organization (either may be empty). */
export interface ClinicGrant {
	clinic: Clinic;
	staffRoles: StaffRole[];
	orgRole: OrgRole | null;
}

/** The user's roles in one organization: their `organization_members` row, and their roles at its clinics. */
export interface OrganizationGrant {
	organization: Organization;
	orgRole: OrgRole | null;
	staffRoles: StaffRole[];
}

/**
 * Who may reach which clinic and organization: `user_clinic_roles` and `organization_members`, read as the owner (the
 * guard runs before any row-level security context exists).
 */
@Injectable()
export class AccessRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Clinics where the user holds a role, or whose organization they belong to, by name. */
	async listClinicGrants(userId: string): Promise<ClinicGrant[]> {
		const clinics = await this.prisma.clinic.findMany({
			where: {
				OR: [{ userRoles: { some: { userId } } }, { organization: { members: { some: { userId } } } }],
			},
			include: {
				userRoles: { where: { userId }, select: { role: true } },
				organization: { select: { members: { where: { userId }, select: { role: true } } } },
			},
			orderBy: { name: 'asc' },
		});
		return clinics.map(({ userRoles, organization, ...clinic }) => ({
			clinic,
			staffRoles: userRoles.map(({ role }) => role),
			orgRole: organization.members[0]?.role ?? null,
		}));
	}

	/** The user's grant at one clinic, or null when the clinic doesn't exist. */
	async getClinicGrant(userId: string, clinicId: string): Promise<ClinicGrant | null> {
		const clinic = await this.prisma.clinic.findUnique({
			where: { id: clinicId },
			include: {
				userRoles: { where: { userId }, select: { role: true } },
				organization: { select: { members: { where: { userId }, select: { role: true } } } },
			},
		});
		if (!clinic) {
			return null;
		}
		const { userRoles, organization, ...rest } = clinic;
		return {
			clinic: rest,
			staffRoles: userRoles.map(({ role }) => role),
			orgRole: organization.members[0]?.role ?? null,
		};
	}

	getClinicByPath(path: string): Promise<Clinic | null> {
		return this.prisma.clinic.findFirst({ where: { path }, orderBy: { createdAt: 'asc' } });
	}

	getFirstClinic(): Promise<Clinic | null> {
		return this.prisma.clinic.findFirst({ orderBy: { createdAt: 'asc' } });
	}

	/**
	 * Organizations the user belongs to (a member row or a role at one of its clinics), oldest membership first;
	 * only `organizationId` / the organization of `clinicId` when given.
	 */
	async listOrganizationGrants(
		userId: string,
		filter: { organizationId?: string; clinicId?: string } = {},
	): Promise<OrganizationGrant[]> {
		const organizations = await this.prisma.organization.findMany({
			where: {
				...(filter.organizationId ? { id: filter.organizationId } : {}),
				...(filter.clinicId ? { clinics: { some: { id: filter.clinicId } } } : {}),
				OR: [{ members: { some: { userId } } }, { clinics: { some: { userRoles: { some: { userId } } } } }],
			},
			include: {
				members: { where: { userId }, select: { role: true, createdAt: true } },
				clinics: { select: { userRoles: { where: { userId }, select: { role: true } } } },
			},
			orderBy: { createdAt: 'asc' },
		});
		return organizations
			.map(({ members, clinics, ...organization }) => ({
				organization,
				orgRole: members[0]?.role ?? null,
				staffRoles: [...new Set(clinics.flatMap(({ userRoles }) => userRoles.map(({ role }) => role)))],
				joinedAt: members[0]?.createdAt ?? organization.createdAt,
			}))
			.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
			.map(({ joinedAt: _joinedAt, ...grant }) => grant);
	}
}
