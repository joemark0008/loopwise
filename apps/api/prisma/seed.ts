import crypto from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';

import { loadDotenv, parseEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedBilling } from './seed-billing.js';
import { seedBillingDesk } from './seed-billing-desk.js';
import { seedClinicSetup } from './seed-clinic-setup.js';
import {
	DEMO_CLINIC_CODE,
	DEMO_CLINIC_NAME,
	DEMO_ORG_NAME,
	DEMO_PASSWORD,
	DEMO_STAFF,
	seedClinicalDemo,
	STAFF,
} from './seed-clinical.js';
import { seedDiagnostics } from './seed-diagnostics.js';
import { seedEncounterRecords } from './seed-encounter-record.js';
import { seedFollowUps } from './seed-follow-ups.js';
import { DEMO_INVENTORY_CLERK, seedInventory } from './seed-inventory.js';
import { seedReference } from './seed-reference.js';
import { seedScheduling } from './seed-scheduling.js';
import { seedPanelVitals, seedTrendHistory } from './seed-trends.js';

/**
 * Seeds the database: the reference data (PSGC, ICD-10, RVS), then the synthetic demo — the organization Tagbilaran City
 * Health Center with its clinic `TAG` (also the Wise workspace, at `LOOPWISE_DEFAULT_CLINIC_PATH`), one login per desk,
 * the practitioners, patients and their visits. The demo is skipped when its organization is already there. When
 * GitHub sign-in is configured, the demo logins get a random password (users sign in via GitHub instead).
 *
 * Seeding is system work: it runs on the owner's connection, which row-level security does not restrict.
 */
async function seed() {
	loadDotenv();
	const env = parseEnv();
	const prisma = new PrismaClient({
		adapter: new PrismaPg({
			connectionString: env.DATABASE_URL,
			ssl: env.DB_SSL ? { rejectUnauthorized: false } : undefined,
		}),
	});
	try {
		const clinicPath = env.LOOPWISE_DEFAULT_CLINIC_PATH ?? './';
		const useGithubAuth = env.GITHUB_SSO && !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET;
		const passwordHash = await hashPassword(useGithubAuth ? crypto.randomUUID() : DEMO_PASSWORD);

		console.log('Seeding database...');
		const seeded = await prisma.$transaction(
			async (tx) => {
				await seedReference(tx);
				const demo = await seedClinicalDemo(tx, { passwordHash, clinicPath });
				if (!demo) {
					return false;
				}
				await seedEncounterRecords(tx, demo);
				await seedTrendHistory(tx, demo);
				await seedPanelVitals(tx, demo);

				// --- Other areas' demo data (one call each, added by their agents) ---
				// They run once, on the fresh demo; build on the constants of seed-clinical.ts.
				await seedDiagnostics(tx);
				await seedBilling(tx);
				await seedClinicSetup(tx, demo.practitioners);
				await seedScheduling(tx, demo);
				await seedFollowUps(tx, demo);
				await seedInventory(tx, { passwordHash });
				await seedBillingDesk(tx);
				return true;
			},
			{ timeout: 120_000 },
		);

		console.log('Done.');
		if (!seeded) {
			console.log('  Demo already present.');
			return;
		}
		console.log(`  Organization: ${DEMO_ORG_NAME}`);
		console.log(`  Clinic:       ${DEMO_CLINIC_NAME} (${DEMO_CLINIC_CODE}, ${clinicPath})`);
		console.log('  Logins (synthetic demo):');
		for (const person of STAFF) {
			console.log(`    ${DEMO_STAFF[person.key].padEnd(34)} ${person.roles.join(', ')}`);
		}
		console.log(`    ${DEMO_INVENTORY_CLERK.padEnd(34)} INVENTORY_CLERK`);
		if (!useGithubAuth) {
			console.log(`  Password for all: ${DEMO_PASSWORD}`);
		}
	} finally {
		await prisma.$disconnect();
	}
}

seed().catch((err) => {
	console.error(err);
	process.exit(1);
});
