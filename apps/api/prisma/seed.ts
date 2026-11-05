import 'reflect-metadata';

import crypto from 'node:crypto';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { hashPassword } from 'better-auth/crypto';

import { ClinicRepository } from '../src/clinics/clinic.repository.js';
import { ClinicsModule } from '../src/clinics/clinics.module.js';
import { ConfigModule } from '../src/config/config.module.js';
import { ConfigService } from '../src/config/config.service.js';
import { OrganizationRepository } from '../src/organizations/organization.repository.js';
import { OrganizationsModule } from '../src/organizations/organizations.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { DEMO_PASSWORD, seedClinicalDemo, STAFF } from './seed-clinical.js';
import { seedEncounterRecords } from './seed-encounter-record.js';
import { seedFacilityKeys } from './seed-facility-keys.js';
import { seedPathways, seedResultEvaluations } from './seed-pathways.js';
import { seedBarangays, seedPanelVitals, seedTrendHistory } from './seed-trends.js';

/** Port of upstream `scripts/db.seed.ts`, plus the Loopwise clinical demo (`seed-clinical.ts`). */
const ADMIN_EMAIL = 'test@test.test';
const ADMIN_PASSWORD = 'test1234';
const ADMIN_NAME = 'Test';
const ORG_NAME = 'Test Organization';
const ORG_SLUG = 'test';
const CLINIC_NAME = 'Test Clinic';

@Module({
	imports: [ConfigModule, PrismaModule, ClinicsModule, OrganizationsModule],
	providers: [UserRepository],
})
class SeedModule {}

/**
 * Seeds the database with an admin user, organization and clinic, then the synthetic clinical demo (facilities,
 * staff, patients, pathways, cases). When GitHub auth is configured, the seed users get a random password (users sign
 * in via GitHub instead). Each part is skipped when it is already there.
 */
async function seed() {
	const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });
	try {
		const { env } = app.get(ConfigService);
		const prisma = app.get(PrismaService);
		const users = app.get(UserRepository);
		const orgs = app.get(OrganizationRepository);
		const clinics = app.get(ClinicRepository);

		const clinicPath = env.LOOPWISE_DEFAULT_CLINIC_PATH ?? './';
		const useGithubAuth = env.GITHUB_SSO && !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET;

		console.log('Seeding database...');

		const existingUser = await users.getUser({ email: ADMIN_EMAIL });
		const existingOrg = await orgs.getOrganizationBySlug(ORG_SLUG);
		const existingClinic = await clinics.getClinicByPath(clinicPath);

		const password = useGithubAuth ? crypto.randomUUID() : ADMIN_PASSWORD;
		const hashedPassword = await hashPassword(password);
		const demoPassword = await hashPassword(useGithubAuth ? crypto.randomUUID() : DEMO_PASSWORD);

		// Seeding is system work: it runs on the owner's connection, which row-level security does not restrict.
		const { seeded: seededDemo, facilityKey } = await prisma.$transaction(
			async (tx) => {
				const userId = existingUser?.id ?? crypto.randomUUID();
				if (!existingUser) {
					await users.createUser(
						{ id: userId, name: ADMIN_NAME, email: ADMIN_EMAIL, emailVerified: true },
						{
							id: crypto.randomUUID(),
							accountId: userId,
							providerId: 'credential',
							password: hashedPassword,
						},
						tx,
					);
				}

				const org = existingOrg ?? (await orgs.createOrganization({ name: ORG_NAME, slug: ORG_SLUG }, tx));
				await orgs.addOrgMemberIfMissing({ orgId: org.id, userId, role: 'admin' }, tx);

				const clinic =
					existingClinic ??
					(await clinics.createClinic(
						{ name: CLINIC_NAME, type: 'local', path: clinicPath, orgId: org.id },
						tx,
					));

				if (!(await clinics.getClinicMember(clinic.id, userId, tx))) {
					await clinics.addClinicMember({ clinicId: clinic.id, userId, role: 'admin' }, tx);
				}

				// Before the demo, whose cases follow them; replaces older versions of the definitions.
				await seedPathways(tx);
				const seeded = await seedClinicalDemo(tx, {
					adminUserId: userId,
					adminOrgId: org.id,
					clinicId: clinic.id,
					createUser: async ({ name, email }) => {
						const id = crypto.randomUUID();
						await users.createUser(
							{ id, name, email, emailVerified: true },
							{
								id: crypto.randomUUID(),
								accountId: id,
								providerId: 'credential',
								password: demoPassword,
							},
							tx,
						);
						return id;
					},
				});
				// Separate and idempotent, so databases seeded before the encounter record get it too.
				await seedEncounterRecords(tx);
				await seedTrendHistory(tx);
				await seedBarangays(tx);
				await seedPanelVitals(tx);
				await seedResultEvaluations(tx);
				const facilityKey = await seedFacilityKeys(tx);
				return { seeded, facilityKey };
			},
			{ timeout: 60_000 },
		);

		console.log('Done.');
		if (!existingUser && !useGithubAuth) {
			console.log(`  Email:    ${ADMIN_EMAIL}`);
			console.log(`  Password: ${ADMIN_PASSWORD}`);
		}
		if (!existingClinic) {
			console.log(`  Clinic:   ${CLINIC_NAME} (${clinicPath})`);
		}
		if (seededDemo) {
			console.log('  Clinical demo (synthetic data):');
			for (const person of STAFF) {
				console.log(`    ${person.email.padEnd(30)} ${person.name}`);
			}
			if (!useGithubAuth) {
				console.log(`    Password for all demo staff: ${DEMO_PASSWORD}`);
			}
		} else {
			console.log('  Clinical demo already present.');
		}
		if (facilityKey) {
			console.log(`  Dev facility key (bohol-diagnostics, synthetic, dev only): ${facilityKey}`);
		}
	} finally {
		await app.close();
	}
}

seed().catch((err) => {
	console.error(err);
	process.exit(1);
});
