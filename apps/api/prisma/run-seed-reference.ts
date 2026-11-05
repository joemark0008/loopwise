/**
 * Loads only the reference data (`seedReference`) into `DATABASE_URL`: the e2e global setup runs it after
 * `prisma migrate deploy` (`node --import @swc-node/register/esm-register prisma/run-seed-reference.ts`).
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedReference } from './seed-reference.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error('DATABASE_URL must be set');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
	await prisma.$transaction((tx) => seedReference(tx), { timeout: 60_000 });
} finally {
	await prisma.$disconnect();
}
