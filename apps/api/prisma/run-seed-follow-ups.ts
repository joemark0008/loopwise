import { PrismaPg } from '@prisma/adapter-pg';

import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import { loadDotenv, parseEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
	DEMO_CLINIC_CODE,
	DEMO_ORG_SLUG,
	DEMO_PATIENTS,
	DEMO_STAFF,
	type DemoPractitionerKey,
	type DemoStaffKey,
} from './seed-clinical.js';
import { seedFollowUps } from './seed-follow-ups.js';

/**
 * Adds the follow-ups and referrals demo (`seed-follow-ups.ts`) to a database seeded before it existed, without
 * reseeding: two new patients with past visits whose follow-up dates are overdue and coming up, Carmen's visit with
 * Dr. Cruz due today, an internal referral waiting for Dr. Cruz and an external one. Skipped when already present.
 * `npm run db:seed:follow-ups -w @loopwise/api`.
 */
async function run() {
	loadDotenv();
	const env = parseEnv();
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
	try {
		await prisma.$transaction(async (tx) => {
			const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
			const clinic = await tx.clinic.findFirstOrThrow({
				where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
			});
			const staff = {} as Record<DemoStaffKey, string>;
			for (const [key, email] of Object.entries(DEMO_STAFF) as [DemoStaffKey, string][]) {
				staff[key] = (await tx.user.findUniqueOrThrow({ where: { email } })).id;
			}
			const practitioners = {} as Record<DemoPractitionerKey, string>;
			for (const key of ['admin', 'doctor', 'internist'] as const) {
				practitioners[key] = (await tx.practitioner.findUniqueOrThrow({ where: { userId: staff[key] } })).id;
			}
			const carmen = await tx.patient.findUniqueOrThrow({
				where: {
					organizationId_patientNo: {
						organizationId: organization.id,
						patientNo: DEMO_PATIENTS.carmen.patientNo,
					},
				},
			});
			const sequences = new DocumentSequenceService(new DocumentSequenceRepository());
			const added = await seedFollowUps(tx, {
				organizationId: organization.id,
				clinic: { id: clinic.id, code: clinic.code, name: clinic.name },
				staff,
				practitioners,
				patients: { carmen: carmen.id },
				nextNumber: (key, at) => sequences.next(tx, clinic, key, at),
			});
			console.log(added ? 'Follow-ups demo added.' : 'Follow-ups demo already present.');
		});
	} finally {
		await prisma.$disconnect();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
