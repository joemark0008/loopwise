import { Injectable } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import { isUuid } from '../../common/uuid.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** The role row-level security applies to (migration 0001_rls_and_triggers). */
const RLS_ROLE = 'loopwise_app';

export type ClinicalTx = Prisma.TransactionClient;

export interface ClinicalTxOptions {
	/** Interactive transaction timeout in ms (Prisma's default is 5 s): raise it for long reports or imports. */
	timeout?: number;
}

/**
 * The clinical database (DESIGN.md §8.2). Clinical repositories run their queries through it, never on the bare
 * `PrismaService`: `asUser` puts Postgres row-level security between the user and the data, `asSystem` is for the
 * work that acts for the clinic itself (registration duplicate checks, jobs, seeds) and writes its own audit rows.
 * Every multi-step write runs in one of these transactions, so the change and its `AuditService` row commit together.
 */
@Injectable()
export class ClinicalDbService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Runs `fn` in a transaction as `userId`: `app.user_id` is set for the policies (`app_user_id()` casts it to uuid)
	 * and the role switches to `loopwise_app`, so a query only reaches the rows the user may see and a write that the
	 * policies refuse fails with SQLSTATE 42501 (mapped to FORBIDDEN). Both settings end with the transaction.
	 */
	async asUser<T>(userId: string, fn: (tx: ClinicalTx) => Promise<T>, options: ClinicalTxOptions = {}): Promise<T> {
		if (!isUuid(userId)) {
			// The GUC is cast to uuid inside every policy: a malformed id would surface as an obscure SQL error.
			throw new HandlerError('UNAUTHORIZED', 'Unauthorized');
		}
		return this.prisma.$transaction(async (tx) => {
			await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
			await tx.$executeRawUnsafe(`SET LOCAL ROLE ${RLS_ROLE}`);
			return fn(tx);
		}, options);
	}

	/**
	 * Runs `fn` in a transaction with the connection's role, which row-level security does not restrict. Only for work
	 * that is not a user reading or changing a patient's record on their own behalf; the caller audits what it does
	 * (`AuditService.record` with `userId: null` and an `origin`, or the user it acts for).
	 */
	asSystem<T>(fn: (tx: ClinicalTx) => Promise<T>, options: ClinicalTxOptions = {}): Promise<T> {
		return this.prisma.$transaction(fn, options);
	}
}
