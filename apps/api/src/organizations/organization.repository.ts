import { Injectable } from '@nestjs/common';

import { ConfigService } from '../config/config.service.js';
import type { Organization, OrgMember, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';
import { ProjectRepository } from '../projects/project.repository.js';

export const ORG_ROLES = ['admin', 'user', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export type UserOrgMembership = OrgMember & { organization: Organization };

export interface GoogleConfig {
	orgId: string | undefined;
	clientId: string;
	clientSecret: string;
	authDomains: string;
	usingDbOverride: boolean;
}

/** Port of upstream `queries/organization.queries.ts` (the part Phase 1 needs: membership and first-user setup). */
@Injectable()
export class OrganizationRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
		private readonly projects: ProjectRepository,
	) {}

	getFirstOrganization(executor: DbExecutor = this.prisma): Promise<Organization | null> {
		return executor.organization.findFirst();
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

	getOrgMember(orgId: string, userId: string, executor: DbExecutor = this.prisma): Promise<OrgMember | null> {
		return executor.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
	}

	async addOrgMemberIfMissing(
		member: Prisma.OrgMemberUncheckedCreateInput,
		executor: DbExecutor = this.prisma,
	): Promise<void> {
		await executor.orgMember.createMany({ data: [member], skipDuplicates: true });
	}

	/** The user's oldest organization membership, or the one in `selectedOrganizationId`. */
	getUserOrgMembership(userId: string, selectedOrganizationId?: string | null): Promise<UserOrgMembership | null> {
		return this.prisma.orgMember.findFirst({
			where: selectedOrganizationId ? { userId, orgId: selectedOrganizationId } : { userId },
			include: { organization: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	getUserOrgMembershipByProject(userId: string, projectId: string): Promise<UserOrgMembership | null> {
		return this.prisma.orgMember.findFirst({
			where: { userId, organization: { projects: { some: { id: projectId } } } },
			include: { organization: true },
		});
	}

	/**
	 * Setup of a self-hosted instance: creates the default organization with the user as admin and, when
	 * QUARRY_DEFAULT_PROJECT_PATH is set, the default project with the user as admin. Does nothing when an
	 * organization exists. Runs on the caller's transaction.
	 */
	async initializeDefaultOrganization(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		if (await this.getFirstOrganization(tx)) {
			return;
		}

		const org = await tx.organization.create({ data: { name: 'Default Organization', slug: 'default' } });
		await tx.orgMember.create({ data: { orgId: org.id, userId, role: 'admin' } });

		const projectPath = this.config.env.QUARRY_DEFAULT_PROJECT_PATH;
		if (projectPath && !(await this.projects.getProjectByPath(projectPath, tx))) {
			const projectName = projectPath.split('/').pop() || 'Default Project';
			const project = await this.projects.createProject(
				{ name: projectName, type: 'local', path: projectPath, orgId: org.id },
				tx,
			);
			await tx.projectMember.create({ data: { projectId: project.id, userId, role: 'admin' } });
		}
	}

	/**
	 * The facilities the user works at (DESIGN.md §6.1): their organizations that own no project. Staff are also
	 * members of the workspace organization that owns the project, which is not a facility.
	 */
	getUserFacilities(userId: string): Promise<Organization[]> {
		return this.prisma.organization.findMany({
			where: { orgMembers: { some: { userId } }, projects: { none: {} } },
			orderBy: { name: 'asc' },
		});
	}

	getOrganizationsByIds(ids: readonly string[]): Promise<Organization[]> {
		if (ids.length === 0) {
			return Promise.resolve([]);
		}
		return this.prisma.organization.findMany({ where: { id: { in: [...ids] } } });
	}
}
