import crypto from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';

import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import type { OrgRole } from '../organizations/organization.repository.js';
import type { CreateUserInput } from './dto/create-user.input.js';
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
 * copies the link.
 */
@Injectable()
export class UserManagementService {
	constructor(
		private readonly config: ConfigService,
		private readonly repository: UserManagementRepository,
	) {}

	async listUsers(orgId: string): Promise<ManagedUser[]> {
		return (await this.repository.listOrgUsers(orgId)).map(toManagedUser);
	}

	async createUser(orgId: string, input: CreateUserInput): Promise<PasswordLink> {
		if (await this.repository.isEmailTaken(input.email)) {
			throw new HandlerError('CONFLICT', 'A user with this email already exists.');
		}
		const { token, link } = newLink(INVITE_LINK_TTL_MS);
		const member = await this.repository.createInvitedUser(
			orgId,
			{ id: crypto.randomUUID(), name: input.name, email: input.email },
			input.role,
			link,
		);
		return { user: toManagedUser(member), url: this.url(token), expiresAt: link.expiresAt };
	}

	/** A new invite link for a user who has not set a password yet, or a reset link for anyone else. */
	async createPasswordLink(orgId: string, userId: string): Promise<PasswordLink> {
		const member = await this.getMember(orgId, userId);
		if (member.user.deactivatedAt) {
			throw new HandlerError('BAD_REQUEST', 'Reactivate this user before giving them a password link.');
		}
		const isInvite = member.user.accounts.length === 0;
		const { token, link } = newLink(isInvite ? INVITE_LINK_TTL_MS : RESET_LINK_TTL_MS);
		await this.repository.replacePasswordLink(userId, link);
		return { user: toManagedUser(member), url: this.url(token), expiresAt: link.expiresAt };
	}

	async getPasswordLinkInfo(token: string): Promise<PasswordLinkInfo | null> {
		const user = await this.repository.findPasswordLinkUser(passwordLinkIdentifier(token));
		if (!user || user.deactivatedAt) {
			return null;
		}
		return { name: user.name, email: user.email, isInvite: user.accounts.length === 0 };
	}

	/** Sets the password and returns the email to sign in with. */
	async setPasswordWithLink(token: string, password: string): Promise<string> {
		const identifier = passwordLinkIdentifier(token);
		const user = await this.repository.findPasswordLinkUser(identifier);
		if (!user || user.deactivatedAt) {
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
	async updateRole(orgId: string, actorId: string, userId: string, role: OrgRole): Promise<ManagedUser> {
		if (userId === actorId) {
			throw new HandlerError('BAD_REQUEST', 'You cannot change your own role.');
		}
		const member = await this.getMember(orgId, userId);
		await this.repository.updateRole(orgId, userId, role);
		return toManagedUser({ ...member, role });
	}

	async setUserActive(orgId: string, actorId: string, userId: string, active: boolean): Promise<ManagedUser> {
		if (userId === actorId) {
			throw new HandlerError('BAD_REQUEST', 'You cannot deactivate your own account.');
		}
		await this.getMember(orgId, userId);
		await this.repository.setDeactivated(userId, !active);
		return toManagedUser(await this.getMember(orgId, userId));
	}

	private async getMember(orgId: string, userId: string): Promise<OrgUser> {
		const member = await this.repository.getOrgUser(orgId, userId);
		if (!member) {
			throw new HandlerError('NOT_FOUND', 'User not found.');
		}
		return member;
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
	if (user.deactivatedAt) {
		status = ManagedUserStatus.DEACTIVATED;
	} else if (user.accounts.length === 0) {
		status = ManagedUserStatus.INVITED;
	}
	return { id: user.id, name: user.name, email: user.email, role: member.role, status, createdAt: user.createdAt };
}
