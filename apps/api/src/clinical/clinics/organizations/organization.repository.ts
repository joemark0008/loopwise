import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../../config/config.service.js';
import type { Organization, OrgRole, Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type { DbExecutor } from '../../../prisma/prisma.types.js';

export interface GoogleConfig {
	orgId: string | undefined;
	clientId: string;
	clientSecret: string;
	authDomains: string;
	usingDbOverride: boolean;
}

/**
 * `organizations` and `organization_members`: lookup, membership and first-user setup. Read before any row-level
 * security context exists (sign-in, setup, the guards' organization lookups), so on the owner's connection.
 */
@Injectable()
export class OrganizationRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly config: ConfigService,
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

	/**
	 * Setup of a self-hosted instance: the default organization with the user as its ADMIN, on the caller's
	 * transaction. Null when an organization already exists.
	 */
	async createDefaultOrganization(userId: string, tx: Prisma.TransactionClient): Promise<Organization | null> {
		if (await this.getFirstOrganization(tx)) {
			return null;
		}
		const org = await tx.organization.create({ data: { name: 'Default Organization', slug: 'default' } });
		await tx.organizationMember.create({ data: { organizationId: org.id, userId, role: 'ADMIN' } });
		return org;
	}

	getOrganizationsByIds(ids: readonly string[]): Promise<Organization[]> {
		if (ids.length === 0) {
			return Promise.resolve([]);
		}
		return this.prisma.organization.findMany({ where: { id: { in: [...ids] } } });
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
