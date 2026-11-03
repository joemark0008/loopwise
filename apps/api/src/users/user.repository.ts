import crypto from 'node:crypto';

import type { UserPreferences } from '@loopwise/shared/types';
import { Injectable } from '@nestjs/common';

import type { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DbExecutor } from '../prisma/prisma.types.js';

const CREDENTIAL_PROVIDER_ID = 'credential';

/** Upstream `StoredUserPreferences`: what `user_preference.preferences` holds. */
export interface StoredUserPreferences extends UserPreferences {
	projectPreferences?: Record<string, unknown>;
	supportRequestSentAt?: number;
}

export interface UserProfile {
	id: string;
	name: string;
	email: string;
	image: string | null;
}

export const createMessagingProviderCode = (): string => {
	return crypto.randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();
};

/** Port of upstream `queries/user.queries.ts` and `queries/account.queries.ts` (Phase 1 subset). */
@Injectable()
export class UserRepository {
	constructor(private readonly prisma: PrismaService) {}

	getUser(identifier: { id: string } | { email: string }): Promise<User | null> {
		return this.prisma.user.findUnique({
			where: 'id' in identifier ? { id: identifier.id } : { email: identifier.email },
		});
	}

	getUserProfile(userId: string): Promise<UserProfile | null> {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, name: true, email: true, image: true },
		});
	}

	async getUserName(userId: string): Promise<string | null> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
		return user?.name ?? null;
	}

	async updateUser(id: string, name: string): Promise<void> {
		await this.prisma.user.update({ where: { id }, data: { name } });
	}

	async isUserDeactivated(userId: string): Promise<boolean> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { deactivatedAt: true } });
		return Boolean(user?.deactivatedAt);
	}

	async getUserMemoryEnabled(userId: string): Promise<boolean> {
		const user = await this.prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { memoryEnabled: true },
		});
		return user.memoryEnabled;
	}

	async setUserMemoryEnabled(userId: string, memoryEnabled: boolean): Promise<void> {
		await this.prisma.user.update({ where: { id: userId }, data: { memoryEnabled } });
	}

	async markEmailVerified(userId: string): Promise<void> {
		await this.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
	}

	countUsers(executor: DbExecutor = this.prisma): Promise<number> {
		return executor.user.count();
	}

	getUsersByIds(userIds: readonly string[]): Promise<User[]> {
		if (userIds.length === 0) {
			return Promise.resolve([]);
		}
		return this.prisma.user.findMany({ where: { id: { in: [...userIds] } } });
	}

	/** Creates a user with its credential (or provider) account. */
	createUser(
		user: Omit<Prisma.UserCreateInput, 'messagingProviderCode'>,
		account: Omit<Prisma.AccountUncheckedCreateInput, 'userId'>,
		executor: DbExecutor = this.prisma,
	): Promise<User> {
		return executor.user.create({
			data: {
				...user,
				messagingProviderCode: createMessagingProviderCode(),
				accounts: { create: account },
			},
		});
	}

	getCredentialAccount(userId: string): Promise<{ id: string; password: string | null } | null> {
		return this.prisma.account.findFirst({
			where: { userId, providerId: CREDENTIAL_PROVIDER_ID },
			select: { id: true, password: true },
		});
	}

	async updateAccountPassword(
		accountId: string,
		hashedPassword: string,
		userId: string,
		needToResetPassword = true,
	): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.account.update({ where: { id: accountId }, data: { password: hashedPassword } }),
			this.prisma.user.update({ where: { id: userId }, data: { requiresPasswordReset: needToResetPassword } }),
		]);
	}

	async deleteOtherSessions(userId: string, keepSessionId: string): Promise<void> {
		await this.prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
	}

	/** Port of upstream `queries/user-preference.queries.ts`. */
	async getUserPreferences(userId: string): Promise<StoredUserPreferences> {
		const row = await this.prisma.userPreference.findUnique({ where: { userId }, select: { preferences: true } });
		return (row?.preferences ?? {}) as StoredUserPreferences;
	}

	/** Merges `partial` into the stored preferences, with the row locked so concurrent updates don't drop keys. */
	updateUserPreferences(userId: string, partial: Partial<StoredUserPreferences>): Promise<StoredUserPreferences> {
		return this.mutateUserPreferences(userId, (current) => ({ ...current, ...partial }));
	}

	/** Replaces the stored preferences with `transform(current)`, with the row locked so concurrent transforms queue. */
	mutateUserPreferences(
		userId: string,
		transform: (current: StoredUserPreferences) => StoredUserPreferences,
	): Promise<StoredUserPreferences> {
		return this.prisma.$transaction(async (tx) => {
			await tx.userPreference.upsert({ where: { userId }, create: { userId, preferences: {} }, update: {} });
			const [row] = await tx.$queryRaw<{ preferences: StoredUserPreferences }[]>`
				SELECT preferences FROM user_preference WHERE user_id = ${userId} FOR UPDATE`;
			const preferences = transform(row?.preferences ?? {});
			await tx.userPreference.update({
				where: { userId },
				data: { preferences: preferences as Prisma.InputJsonValue },
			});
			return preferences;
		});
	}
}
