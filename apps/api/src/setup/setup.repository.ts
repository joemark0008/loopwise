import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRepository } from '../users/user.repository.js';

/** Arbitrary key of the transaction-scoped advisory lock that serializes setup attempts. */
const SETUP_LOCK_KEY = 7283910;

@Injectable()
export class SetupRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: UserRepository,
	) {}

	/**
	 * Creates the first user, then runs `afterCreate` (the default organization) on the same transaction; refuses once
	 * any user exists.
	 */
	createFirstAdmin(
		user: Parameters<UserRepository['createUser']>[0],
		account: Parameters<UserRepository['createUser']>[1],
		afterCreate: (created: User, tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<User> {
		return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
			// $executeRaw, not $queryRaw: pg_advisory_xact_lock returns void, which Prisma can't deserialize.
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;
			if ((await this.users.countUsers(tx)) > 0) {
				throw new HandlerError('CONFLICT', 'Setup is already complete.');
			}
			const created = await this.users.createUser(user, account, tx);
			await afterCreate(created, tx);
			return created;
		});
	}
}
