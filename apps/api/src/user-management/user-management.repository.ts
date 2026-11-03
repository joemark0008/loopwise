import { Injectable } from '@nestjs/common';

import type { OrgMember, Prisma, User } from '../generated/prisma/client.js';
import type { OrgRole } from '../organizations/organization.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createMessagingProviderCode } from '../users/user.repository.js';
import { PASSWORD_LINK_PREFIX } from './password-link-token.js';

const CREDENTIAL_PROVIDER_ID = 'credential';

export type OrgUser = OrgMember & { user: User & { accounts: { id: string }[] } };

export interface NewPasswordLink {
	identifier: string;
	expiresAt: Date;
}

const orgUserInclude = { user: { include: { accounts: { select: { id: true } } } } } as const;

@Injectable()
export class UserManagementRepository {
	constructor(private readonly prisma: PrismaService) {}

	listOrgUsers(orgId: string): Promise<OrgUser[]> {
		return this.prisma.orgMember.findMany({
			where: { orgId },
			include: orgUserInclude,
			orderBy: { user: { name: 'asc' } },
		});
	}

	getOrgUser(orgId: string, userId: string): Promise<OrgUser | null> {
		return this.prisma.orgMember.findUnique({
			where: { orgId_userId: { orgId, userId } },
			include: orgUserInclude,
		});
	}

	isEmailTaken(email: string): Promise<boolean> {
		return this.prisma.user.findUnique({ where: { email }, select: { id: true } }).then(Boolean);
	}

	/** Creates a user with no account (they get one when they use the link), their membership and their link. */
	createInvitedUser(
		orgId: string,
		user: { id: string; name: string; email: string },
		role: OrgRole,
		link: NewPasswordLink,
	): Promise<OrgUser> {
		return this.prisma.$transaction(async (tx) => {
			await tx.user.create({
				data: { ...user, emailVerified: false, messagingProviderCode: createMessagingProviderCode() },
			});
			await tx.orgMember.create({ data: { orgId, userId: user.id, role } });
			await this.replaceLinks(tx, user.id, link);
			return tx.orgMember.findUniqueOrThrow({
				where: { orgId_userId: { orgId, userId: user.id } },
				include: orgUserInclude,
			});
		});
	}

	/** Issues a new link for the user; any earlier link of theirs stops working. */
	async replacePasswordLink(userId: string, link: NewPasswordLink): Promise<void> {
		await this.prisma.$transaction((tx) => this.replaceLinks(tx, userId, link));
	}

	/** The user a link belongs to, while it is unexpired. */
	async findPasswordLinkUser(identifier: string): Promise<(User & { accounts: { id: string }[] }) | null> {
		const link = await this.prisma.verification.findFirst({
			where: { identifier, expiresAt: { gt: new Date() } },
			select: { value: true },
		});
		if (!link) {
			return null;
		}
		return this.prisma.user.findUnique({
			where: { id: link.value },
			include: { accounts: { select: { id: true } } },
		});
	}

	/**
	 * Uses the link once: sets the credential password (creating the account for a new user), clears the forced
	 * reset, marks the email verified (the admin vouched for it and the user reached the link), and signs the
	 * user out everywhere. Returns false when the link was already used or expired.
	 */
	consumePasswordLink(identifier: string, userId: string, hashedPassword: string): Promise<boolean> {
		return this.prisma.$transaction(async (tx) => {
			const { count } = await tx.verification.deleteMany({
				where: { identifier, value: userId, expiresAt: { gt: new Date() } },
			});
			if (count === 0) {
				return false;
			}
			const account = await tx.account.findFirst({
				where: { userId, providerId: CREDENTIAL_PROVIDER_ID },
				select: { id: true },
			});
			if (account) {
				await tx.account.update({ where: { id: account.id }, data: { password: hashedPassword } });
			} else {
				await tx.account.create({
					data: { userId, accountId: userId, providerId: CREDENTIAL_PROVIDER_ID, password: hashedPassword },
				});
			}
			await tx.user.update({
				where: { id: userId },
				data: { requiresPasswordReset: false, emailVerified: true },
			});
			await tx.verification.deleteMany({
				where: { identifier: { startsWith: PASSWORD_LINK_PREFIX }, value: userId },
			});
			await tx.session.deleteMany({ where: { userId } });
			return true;
		});
	}

	async updateRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
		await this.prisma.orgMember.update({ where: { orgId_userId: { orgId, userId } }, data: { role } });
	}

	/** Deactivating also ends the user's sessions and voids their links; reactivating clears the flag only. */
	async setDeactivated(userId: string, deactivated: boolean): Promise<void> {
		if (!deactivated) {
			await this.prisma.user.update({ where: { id: userId }, data: { deactivatedAt: null } });
			return;
		}
		await this.prisma.$transaction([
			this.prisma.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } }),
			this.prisma.session.deleteMany({ where: { userId } }),
			this.prisma.verification.deleteMany({
				where: { identifier: { startsWith: PASSWORD_LINK_PREFIX }, value: userId },
			}),
		]);
	}

	private async replaceLinks(tx: Prisma.TransactionClient, userId: string, link: NewPasswordLink): Promise<void> {
		await tx.verification.deleteMany({
			where: { identifier: { startsWith: PASSWORD_LINK_PREFIX }, value: userId },
		});
		await tx.verification.create({
			data: { identifier: link.identifier, value: userId, expiresAt: link.expiresAt },
		});
	}
}
