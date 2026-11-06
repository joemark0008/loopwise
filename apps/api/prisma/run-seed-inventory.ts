import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';

import { loadDotenv, parseEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_PASSWORD } from './seed-clinical.js';
import { seedInventory } from './seed-inventory.js';

/**
 * Adds the pharmacy and inventory demo (`seed-inventory.ts`) to a database seeded before it existed, without reseeding
 * or resetting anything: suppliers, items linked to the price list, deliveries and lots, the inventory clerk login and
 * the prescriptions waiting at the pharmacy. Adds only what is missing, so it is safe to run again.
 * `npm run db:seed:inventory -w @loopwise/api`.
 */
async function run() {
	loadDotenv();
	const env = parseEnv();
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
	try {
		const passwordHash = await hashPassword(DEMO_PASSWORD);
		await prisma.$transaction((tx) => seedInventory(tx, { passwordHash }), { timeout: 60_000 });
		console.log('Pharmacy and inventory demo added (existing rows kept).');
	} finally {
		await prisma.$disconnect();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
