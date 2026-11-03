import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

/** A Prisma client or an interactive transaction: repository methods that can join a caller's transaction take one. */
export type DbExecutor = PrismaClient | Prisma.TransactionClient;
