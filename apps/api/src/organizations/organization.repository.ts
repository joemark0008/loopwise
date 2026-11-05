import { Injectable } from '@nestjs/common';

import { ClinicRepository } from '../clinics/clinic.repository.js';
import { ConfigService } from '../config/config.service.js';
import type { Organization, OrganizationMember, OrgRole, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';

export type UserOrgMembership = OrganizationMember & { organization: Organization };

export interface GoogleConfig {
	orgId: string | undefined;
	clientId: string;
	clientSecret: string;
	authDomains: string;
	usingDbOverride: boolean;
}

/** `organizations` and `organization_members`: lookup, membership and first-user setup. */
@Injectable()
export class OrganizationRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly clinics: ClinicRepository,
	) {}

	getFirstOrganization(executor: DbExecutor = this.prisma): Promise<Organization | null> {
		return executor.organization.findFirst({ orderBy: { createdAt: 'asc' } });
	}

	/** Google sign-in settings: the first organization's credential, with the env as fallback. */
	async getGoogleConfig(): Promise<GoogleConfig> {
		const org = await this.getFirstOrganization();
		const { env } = this.config;
		return {
			orgId: org?.id,
			clientId: org?.googleClientId || env.GOOGLE_CLIENT_ID || '',
			clientSecret: org?.googleClientSecret || env.GOOGLE_CLIENT_SECRET || '',
			authDomains: org?.googleAuthDomains || env.GOOGLE_AUTH_DOMAINS || '',
			usingDbOverride: !!(org?.googleClientId && org?.googleClientSecret),
		};
	}

	getOrganizationBySlug(slug: string): Promise<Organization | null> {
		return this.prisma.organization.findUnique({ where: { slug } });
	}

	createOrganization(org: Prisma.OrganizationCreateInput, executor: DbExecutor = this.prisma): Promise<Organization> {
		return executor.organization.create({ data: org });
	}

	getOrganizationMember(
		organizationId: string,
		userId: string,
		executor: DbExecutor = this.prisma,
	): Promise<OrganizationMember | null> {
		return executor.organizationMember.findUnique({
			where: { organizationId_userId: { organizationId, userId } },
		});
	}

	async addOrganizationMemberIfMissing(
		member: Prisma.OrganizationMemberUncheckedCreateInput,
		executor: DbExecutor = this.prisma,
	): Promise<void> {
		await executor.organizationMember.createMany({ data: [member], skipDuplicates: true });
	}

	/** The user's oldest organization membership, or the one in `selectedOrganizationId`. */
	getUserOrgMembership(userId: string, selectedOrganizationId?: string | null): Promise<UserOrgMembership | null> {
		return this.prisma.organizationMember.findFirst({
			where: selectedOrganizationId ? { userId, organizationId: selectedOrganizationId } : { userId },
			include: { organization: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	/**
	 * Setup of a self-hosted instance: creates the default organization with the user as its ADMIN and, when
	 * LOOPWISE_DEFAULT_CLINIC_PATH is set, the default clinic with the user as SUPER_ADMIN + ADMIN there. Does nothing
	 * when an organization exists. Runs on the caller's transaction.
	 */
	async initializeDefaultOrganization(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		if (await this.getFirstOrganization(tx)) {
			return;
		}

		const org = await tx.organization.create({ data: { name: 'Default Organization', slug: 'default' } });
		await tx.organizationMember.create({ data: { organizationId: org.id, userId, role: 'ADMIN' } });

		const clinicPath = this.config.env.LOOPWISE_DEFAULT_CLINIC_PATH;
		if (clinicPath && !(await this.clinics.getClinicByPath(clinicPath, tx))) {
			const clinicName = clinicPath.split('/').pop() || 'Default Clinic';
			const clinic = await this.clinics.createClinic(
				{ name: clinicName, kind: 'local', path: clinicPath, organizationId: org.id },
				tx,
			);
			await this.clinics.grantClinicRoles(clinic.id, userId, ['SUPER_ADMIN', 'ADMIN'], tx);
		}
	}

	getOrganizationsByIds(ids: readonly string[]): Promise<Organization[]> {
		if (ids.length === 0) {
			return Promise.resolve([]);
		}
		return this.prisma.organization.findMany({ where: { id: { in: [...ids] } } });
	}

	/** Whether the user's `organization_members` role is ADMIN. */
	async isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean> {
		const member = await this.getOrganizationMember(organizationId, userId);
		return member?.role === 'ADMIN';
	}

	/** The organization roles of a user (`organization_members`), by organization name. */
	listUserOrganizations(userId: string): Promise<{ organization: Organization; role: OrgRole }[]> {
		return this.prisma.organizationMember
			.findMany({
				where: { userId },
				include: { organization: true },
				orderBy: { organization: { name: 'asc' } },
			})
			.then((rows) => rows.map(({ organization, role }) => ({ organization, role })));
	}
}
