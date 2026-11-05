import { PrismaPg } from '@prisma/adapter-pg';

import { loadDotenv, parseEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedClinicSetup } from './seed-clinic-setup.js';
import { DEMO_STAFF, type DemoPractitionerKey } from './seed-clinical.js';

/**
 * Adds the clinic setup demo (`seed-clinic-setup.ts`) to a database seeded before it existed, without reseeding or
 * resetting anything: registrations, consult fees, weekly hours where a doctor has none, Dr. Cruz's leave, credential
 * expiries and two clinic prices. Only fills empty values, so it is safe to run again.
 * `npm run db:seed:clinic-setup -w @loopwise/api`.
 */
async function run() {
	loadDotenv();
	const env = parseEnv();
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
	try {
		await prisma.$transaction(async (tx) => {
			const practitioners = {} as Record<DemoPractitionerKey, string>;
			for (const key of ['admin', 'doctor', 'internist'] as const) {
				const user = await tx.user.findUniqueOrThrow({ where: { email: DEMO_STAFF[key] } });
				practitioners[key] = (await tx.practitioner.findUniqueOrThrow({ where: { userId: user.id } })).id;
			}
			await seedClinicSetup(tx, practitioners);
		});
		console.log('Clinic setup demo added (existing values kept).');
	} finally {
		await prisma.$disconnect();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
