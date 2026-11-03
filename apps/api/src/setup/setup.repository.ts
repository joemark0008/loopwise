import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { Prisma, User } from '../generated/prisma/client.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRepository } from '../users/user.repository.js';

/** Arbitrary key of the transaction-scoped advisory lock that serializes setup attempts. */
const SETUP_LOCK_KEY = 7283910;

@Injectable()
export class SetupRepository {
	constructor(
		private readonly prisma: PrismaService,
		private readonly users: UserRepository,
		private readonly organizations: OrganizationRepository,
	) {}

	/** Creates the first user and the default organization in one transaction; refuses once any user exists. */
	createFirstAdmin(
		user: Parameters<UserRepository['createUser']>[0],
		account: Parameters<UserRepository['createUser']>[1],
	): Promise<User> {
		return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
			// $executeRaw, not $queryRaw: pg_advisory_xact_lock returns void, which Prisma can't deserialize.
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_LOCK_KEY})`;
			if ((await this.users.countUsers(tx)) > 0) {
				throw new HandlerError('CONFLICT', 'Setup is already complete.');
			}
			const created = await this.users.createUser(user, account, tx);
			await this.organizations.initializeDefaultOrganization(created.id, tx);
			return created;
		});
	}
}
