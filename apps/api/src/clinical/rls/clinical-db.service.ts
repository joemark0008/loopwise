import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** The role row-level security applies to (migration 0006_clinical_rls). */
const RLS_ROLE = 'loopwise_app';

/**
 * The clinical database (DESIGN.md §10.2). Clinical repositories run their queries through it, never on the bare
 * `PrismaService`: `asUser` puts Postgres row-level security between the user and the data, `asSystem` is for the
 * work that acts for the hub itself and writes its own audit rows.
 */
@Injectable()
export class ClinicalDbService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Runs `fn` in a transaction as `userId`: the user id is set for the policies and the role switches to
	 * `loopwise_app`, so a query only reaches the rows the user may see. Both settings end with the transaction.
	 */
	asUser<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
			await tx.$executeRawUnsafe(`SET LOCAL ROLE ${RLS_ROLE}`);
			return fn(tx);
		});
	}

	/** Runs `fn` in a transaction with the connection's role, which row-level security does not restrict: HL7 ingest, jobs, patient registration. */
	asSystem<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.prisma.$transaction(fn);
	}
}
