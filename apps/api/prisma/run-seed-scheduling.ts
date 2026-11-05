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
	type DemoContext,
	type DemoPatientKey,
	type DemoPractitionerKey,
	type DemoStaffKey,
} from './seed-clinical.js';
import { seedScheduling } from './seed-scheduling.js';

/**
 * Adds the scheduling demo (`seed-scheduling.ts`) to a database seeded before it existed, without reseeding: clinic
 * hours, today's and tomorrow's bookings and today's queue. Skipped when the demo already has bookings.
 * `npm run db:seed:scheduling -w @loopwise/api`.
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
			if (await tx.appointment.count({ where: { clinicId: clinic.id } })) {
				console.log('Scheduling demo already present.');
				return;
			}
			const staff = {} as Record<DemoStaffKey, string>;
			for (const [key, email] of Object.entries(DEMO_STAFF) as [DemoStaffKey, string][]) {
				staff[key] = (await tx.user.findUniqueOrThrow({ where: { email } })).id;
			}
			const practitioners = {} as Record<DemoPractitionerKey, string>;
			for (const key of ['admin', 'doctor', 'internist'] as const) {
				practitioners[key] = (await tx.practitioner.findUniqueOrThrow({ where: { userId: staff[key] } })).id;
			}
			const patients = {} as Record<DemoPatientKey, string>;
			for (const [key, { patientNo }] of Object.entries(DEMO_PATIENTS) as [
				DemoPatientKey,
				{ patientNo: string },
			][]) {
				patients[key] = (
					await tx.patient.findUniqueOrThrow({
						where: { organizationId_patientNo: { organizationId: organization.id, patientNo } },
					})
				).id;
			}
			const today = async (patient: DemoPatientKey, status: 'OPEN' | 'IN_PROGRESS') => {
				const row = await tx.encounter.findFirstOrThrow({
					where: { patientId: patients[patient], status },
					orderBy: { startedAt: 'desc' },
				});
				return { id: row.id, patientId: row.patientId, startedAt: row.startedAt };
			};
			const sequences = new DocumentSequenceService(new DocumentSequenceRepository());
			const demo = {
				organizationId: organization.id,
				clinic: { id: clinic.id, code: clinic.code, name: clinic.name },
				staff,
				practitioners,
				patients,
				encounters: { joseToday: await today('jose', 'IN_PROGRESS'), ramonToday: await today('ramon', 'OPEN') },
				nextNumber: (key, at) => sequences.next(tx, clinic, key, at),
			} as DemoContext;
			await seedScheduling(tx, demo);
			console.log('Scheduling demo added.');
		});
	} finally {
		await prisma.$disconnect();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
