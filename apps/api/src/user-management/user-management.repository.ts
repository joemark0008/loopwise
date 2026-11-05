import { Injectable } from '@nestjs/common';

import type { OrganizationMember, OrgRole, Prisma, StaffRole, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createMessagingProviderCode, splitName } from '../users/user.repository.js';
import { PASSWORD_LINK_PREFIX } from './password-link-token.js';

const CREDENTIAL_PROVIDER_ID = 'credential';

/** A member of the organization, with their accounts and their roles at the clinic the page shows (if any). */
export type OrgUser = OrganizationMember & {
	user: User & { accounts: { id: string }[]; clinicRoles: { role: StaffRole }[] };
};

export interface NewPasswordLink {
	identifier: string;
	expiresAt: Date;
}

/** Roles at `clinicId` only; none when the page shows no clinic. */
function orgUserInclude(clinicId: string | null) {
	return {
		user: {
			include: {
				accounts: { select: { id: true } },
				clinicRoles: { where: { clinicId: clinicId ?? { in: [] } }, select: { role: true } },
			},
		},
	} satisfies Prisma.OrganizationMemberInclude;
}

/** Users of an organization (`organization_members`), their set-password links and their clinic roles. */
@Injectable()
export class UserManagementRepository {
	constructor(private readonly prisma: PrismaService) {}

	listOrgUsers(organizationId: string, clinicId: string | null): Promise<OrgUser[]> {
		return this.prisma.organizationMember.findMany({
			where: { organizationId },
			include: orgUserInclude(clinicId),
			orderBy: { user: { name: 'asc' } },
		});
	}

	getOrgUser(organizationId: string, userId: string, clinicId: string | null): Promise<OrgUser | null> {
		return this.prisma.organizationMember.findUnique({
			where: { organizationId_userId: { organizationId, userId } },
			include: orgUserInclude(clinicId),
		});
	}

	/** Replaces the user's roles at the clinic (none: they keep only their organization role there). */
	async setClinicRoles(clinicId: string, userId: string, roles: readonly StaffRole[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.userClinicRole.deleteMany({ where: { clinicId, userId, role: { notIn: [...roles] } } });
			await tx.userClinicRole.createMany({
				data: roles.map((role) => ({ clinicId, userId, role })),
				skipDuplicates: true,
			});
		});
	}

	/** Whether the clinic belongs to the organization (the clinic the request selected may be another one's). */
	async isClinicOfOrganization(clinicId: string, organizationId: string): Promise<boolean> {
		const clinic = await this.prisma.clinic.findFirst({
			where: { id: clinicId, organizationId },
			select: { id: true },
		});
		return clinic !== null;
	}

	isEmailTaken(email: string): Promise<boolean> {
		return this.prisma.user.findUnique({ where: { email }, select: { id: true } }).then(Boolean);
	}

	/**
	 * Creates a user with no account (they get one when they use the link), their organization membership, their roles
	 * at `clinicId` and their link, in one transaction.
	 */
	createInvitedUser(
		organizationId: string,
		user: { id: string; name: string; email: string },
		role: OrgRole,
		clinicRoles: { clinicId: string; roles: readonly StaffRole[] } | null,
		link: NewPasswordLink,
	): Promise<OrgUser> {
		return this.prisma.$transaction(async (tx) => {
			await tx.user.create({
				data: {
					...user,
					...splitName(user.name),
					emailVerified: false,
					messagingProviderCode: createMessagingProviderCode(),
				},
			});
			await tx.organizationMember.create({ data: { organizationId, userId: user.id, role } });
			if (clinicRoles && clinicRoles.roles.length > 0) {
				await tx.userClinicRole.createMany({
					data: clinicRoles.roles.map((staffRole) => ({
						clinicId: clinicRoles.clinicId,
						userId: user.id,
						role: staffRole,
					})),
					skipDuplicates: true,
				});
			}
			await this.replaceLinks(tx, user.id, link);
			return tx.organizationMember.findUniqueOrThrow({
				where: { organizationId_userId: { organizationId, userId: user.id } },
				include: orgUserInclude(clinicRoles?.clinicId ?? null),
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

	async updateRole(organizationId: string, userId: string, role: OrgRole): Promise<void> {
		await this.prisma.organizationMember.update({
			where: { organizationId_userId: { organizationId, userId } },
			data: { role },
		});
	}

	/** Deactivating also ends the user's sessions and voids their links; reactivating sets the flag only. */
	async setActive(userId: string, active: boolean): Promise<void> {
		if (active) {
			await this.prisma.user.update({ where: { id: userId }, data: { isActive: true } });
			return;
		}
		await this.prisma.$transaction([
			this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
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
