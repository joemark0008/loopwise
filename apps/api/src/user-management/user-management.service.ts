import crypto from 'node:crypto';

import {
	ORG_ROLE_BY_USER_ROLE,
	orgRoleToUserRole,
	STAFF_ROLE_LABELS,
	type StaffRole,
} from '@loopwise/shared/staff-roles';
import { Injectable } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';

import { HandlerError } from '../common/errors/handler-error.js';
import { isUuid } from '../common/uuid.js';
import { ConfigService } from '../config/config.service.js';
import type { CreateUserInput, OrgAccessLevel } from './dto/create-user.input.js';
import { type ManagedUser, ManagedUserStatus } from './models/managed-user.model.js';
import type { PasswordLink, PasswordLinkInfo } from './models/password-link.model.js';
import {
	buildPasswordLinkUrl,
	generatePasswordLinkToken,
	INVITE_LINK_TTL_MS,
	passwordLinkIdentifier,
	RESET_LINK_TTL_MS,
} from './password-link-token.js';
import { type OrgUser, UserManagementRepository } from './user-management.repository.js';

const INVALID_LINK_MESSAGE = 'This link is invalid or has expired. Ask your admin for a new one.';

/**
 * Admin-managed accounts. Nobody signs up: an organization admin creates the user and hands them a one-time
 * link to choose their password, and issues a new link to reset a forgotten one. No email is sent; the admin
 * copies the link. The page also sets each user's roles at the selected clinic (`user_clinic_roles`), which pick their
 * desks (DOCTOR, NURSE, CASHIER …); `clinicId` is that clinic when it belongs to the organization, else null.
 */
@Injectable()
export class UserManagementService {
	constructor(
		private readonly config: ConfigService,
		private readonly repository: UserManagementRepository,
	) {}

	/** The organization's users, with their roles at the selected clinic. */
	async listUsers(orgId: string, selectedClinicId: string | null): Promise<ManagedUser[]> {
		const clinicId = await this.clinicOf(orgId, selectedClinicId);
		return (await this.repository.listOrgUsers(orgId, clinicId)).map(toManagedUser);
	}

	/** Creates the user, their organization role and their roles at the selected clinic, and returns their link. */
	async createUser(orgId: string, selectedClinicId: string | null, input: CreateUserInput): Promise<PasswordLink> {
		if (await this.repository.isEmailTaken(input.email)) {
			throw new HandlerError('CONFLICT', 'A user with this email already exists.');
		}
		const clinicId = await this.clinicOf(orgId, selectedClinicId);
		const staffRoles = input.staffRoles ?? [];
		if (staffRoles.length > 0 && !clinicId) {
			throw new HandlerError('BAD_REQUEST', 'Select a clinic of this organization to give clinic roles.');
		}
		const { token, link } = newLink(INVITE_LINK_TTL_MS);
		const member = await this.repository.createInvitedUser(
			orgId,
			{ id: crypto.randomUUID(), name: input.name, email: input.email },
			ORG_ROLE_BY_USER_ROLE[input.role],
			clinicId ? { clinicId, roles: staffRoles } : null,
			link,
		);
		return { user: toManagedUser(member), url: this.url(token), expiresAt: link.expiresAt };
	}

	/** A new invite link for a user who has not set a password yet, or a reset link for anyone else. */
	async createPasswordLink(orgId: string, selectedClinicId: string | null, userId: string): Promise<PasswordLink> {
		const member = await this.getMember(orgId, userId, await this.clinicOf(orgId, selectedClinicId));
		if (!member.user.isActive) {
			throw new HandlerError('BAD_REQUEST', 'Reactivate this user before giving them a password link.');
		}
		const isInvite = member.user.accounts.length === 0;
		const { token, link } = newLink(isInvite ? INVITE_LINK_TTL_MS : RESET_LINK_TTL_MS);
		await this.repository.replacePasswordLink(userId, link);
		return { user: toManagedUser(member), url: this.url(token), expiresAt: link.expiresAt };
	}

	async getPasswordLinkInfo(token: string): Promise<PasswordLinkInfo | null> {
		const user = await this.repository.findPasswordLinkUser(passwordLinkIdentifier(token));
		if (!user || !user.isActive) {
			return null;
		}
		return { name: user.name, email: user.email, isInvite: user.accounts.length === 0 };
	}

	/** Sets the password and returns the email to sign in with. */
	async setPasswordWithLink(token: string, password: string): Promise<string> {
		const identifier = passwordLinkIdentifier(token);
		const user = await this.repository.findPasswordLinkUser(identifier);
		if (!user || !user.isActive) {
			throw new HandlerError('NOT_FOUND', INVALID_LINK_MESSAGE);
		}
		const hashed = await hashPassword(password);
		if (!(await this.repository.consumePasswordLink(identifier, user.id, hashed))) {
			throw new HandlerError('NOT_FOUND', INVALID_LINK_MESSAGE);
		}
		return user.email;
	}

	// Admins cannot demote or deactivate themselves, and only an active admin gets here, so the organization
	// always keeps one active admin.
	async updateRole(
		orgId: string,
		selectedClinicId: string | null,
		actorId: string,
		userId: string,
		role: OrgAccessLevel,
	): Promise<ManagedUser> {
		if (userId === actorId) {
			throw new HandlerError('BAD_REQUEST', 'You cannot change your own role.');
		}
		const member = await this.getMember(orgId, userId, await this.clinicOf(orgId, selectedClinicId));
		const orgRole = ORG_ROLE_BY_USER_ROLE[role];
		await this.repository.updateRole(orgId, userId, orgRole);
		return toManagedUser({ ...member, role: orgRole });
	}

	/**
	 * Sets the user's roles at the selected clinic (they pick the user's desks). Nobody changes their own roles, and
	 * only a SUPER_ADMIN of the clinic grants or takes away SUPER_ADMIN.
	 */
	async setStaffRoles(
		orgId: string,
		selectedClinicId: string | null,
		actorId: string,
		userId: string,
		staffRoles: readonly StaffRole[],
	): Promise<ManagedUser> {
		if (userId === actorId) {
			throw new HandlerError('BAD_REQUEST', 'You cannot change your own clinic roles.');
		}
		const clinicId = await this.clinicOf(orgId, selectedClinicId);
		if (!clinicId) {
			throw new HandlerError('BAD_REQUEST', 'Select a clinic of this organization to change clinic roles.');
		}
		const member = await this.getMember(orgId, userId, clinicId);
		const actor = await this.getMember(orgId, actorId, clinicId);
		const holdsSuperAdmin = (m: OrgUser) => m.user.clinicRoles.some(({ role }) => role === 'SUPER_ADMIN');
		const touchesSuperAdmin = holdsSuperAdmin(member) !== staffRoles.includes('SUPER_ADMIN');
		if (touchesSuperAdmin && !holdsSuperAdmin(actor)) {
			throw new HandlerError(
				'FORBIDDEN',
				`Only a ${STAFF_ROLE_LABELS.SUPER_ADMIN.toLowerCase()} can change that role.`,
			);
		}
		const roles = [...new Set(staffRoles)];
		await this.repository.setClinicRoles(clinicId, userId, roles);
		return toManagedUser({ ...member, user: { ...member.user, clinicRoles: roles.map((role) => ({ role })) } });
	}

	async setUserActive(
		orgId: string,
		selectedClinicId: string | null,
		actorId: string,
		userId: string,
		active: boolean,
	): Promise<ManagedUser> {
		if (userId === actorId) {
			throw new HandlerError('BAD_REQUEST', 'You cannot deactivate your own account.');
		}
		const clinicId = await this.clinicOf(orgId, selectedClinicId);
		await this.getMember(orgId, userId, clinicId);
		await this.repository.setActive(userId, active);
		return toManagedUser(await this.getMember(orgId, userId, clinicId));
	}

	private async getMember(orgId: string, userId: string, clinicId: string | null): Promise<OrgUser> {
		const member = await this.repository.getOrgUser(orgId, userId, clinicId);
		if (!member) {
			throw new HandlerError('NOT_FOUND', 'User not found.');
		}
		return member;
	}

	/** The selected clinic when it belongs to the organization. */
	private async clinicOf(orgId: string, selectedClinicId: string | null): Promise<string | null> {
		if (!selectedClinicId || !isUuid(selectedClinicId)) {
			return null;
		}
		return (await this.repository.isClinicOfOrganization(selectedClinicId, orgId)) ? selectedClinicId : null;
	}

	private url(token: string): string {
		return buildPasswordLinkUrl(this.config.baseUrl, token);
	}
}

function newLink(ttlMs: number) {
	const token = generatePasswordLinkToken();
	return {
		token,
		link: { identifier: passwordLinkIdentifier(token), expiresAt: new Date(Date.now() + ttlMs) },
	};
}

export function toManagedUser(member: OrgUser): ManagedUser {
	const { user } = member;
	let status = ManagedUserStatus.ACTIVE;
	if (!user.isActive) {
		status = ManagedUserStatus.DEACTIVATED;
	} else if (user.accounts.length === 0) {
		status = ManagedUserStatus.INVITED;
	}
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: orgRoleToUserRole(member.role),
		staffRoles: user.clinicRoles.map(({ role }) => role),
		status,
		createdAt: user.createdAt,
	};
}
