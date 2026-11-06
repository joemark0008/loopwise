import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG, DEMO_PATIENTS, DEMO_STAFF } from './seed-clinical.js';

const MINUTE = 60 * 1000;

/** Synthetic senior citizen (OSCA) IDs: Jose and Pedro are over 60. Numbers are invented. */
const SENIOR_IDS = [
	{ patient: 'jose', idNumber: 'OSCA-TAG-SYN-0187' },
	{ patient: 'pedro', idNumber: 'OSCA-TAG-SYN-0233' },
] as const;

/**
 * The cashier desk's demo (synthetic), on top of the price list, series and Maria's paid visit (`seed-billing.ts`):
 * senior citizen IDs for Jose and Pedro, doctors' fee terms (Dr. Cruz withholds 5%, the clinic keeps 20% of Dr.
 * Reyes's fees), the cashier's shift open today with a ₱2,000 float, and Pedro's visit of today sent to the cashier
 * (done with Dr. Reyes, an FBS ordered, ticket waiting at the cashier). Idempotent: each part is skipped when present,
 * so `npm run db:seed:billing -w @loopwise/api` can add it to a database seeded before.
 */
export async function seedBillingDesk(tx: Prisma.TransactionClient, now = new Date()): Promise<string[]> {
	const done: string[] = [];
	const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
	const clinic = await tx.clinic.findFirstOrThrow({
		where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
	});
	const user = (email: string) => tx.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
	const cashier = await user(DEMO_STAFF.cashier);
	const reyes = await tx.practitioner.findUniqueOrThrow({ where: { userId: (await user(DEMO_STAFF.doctor)).id } });
	const cruz = await tx.practitioner.findUniqueOrThrow({ where: { userId: (await user(DEMO_STAFF.internist)).id } });
	const patientId = async (key: keyof typeof DEMO_PATIENTS) =>
		(
			await tx.patient.findUniqueOrThrow({
				where: {
					organizationId_patientNo: {
						organizationId: organization.id,
						patientNo: DEMO_PATIENTS[key].patientNo,
					},
				},
			})
		).id;

	for (const { patient, idNumber } of SENIOR_IDS) {
		const id = await patientId(patient);
		if (!(await tx.patientIdentification.count({ where: { patientId: id, type: 'SENIOR_CITIZEN_OSCA' } }))) {
			await tx.patientIdentification.create({
				data: {
					patientId: id,
					type: 'SENIOR_CITIZEN_OSCA',
					idNumber,
					issuedBy: 'OSCA Tagbilaran City (synthetic)',
					issuedAt: new Date('2026-01-15T00:00:00Z'),
				},
			});
			done.push(`OSCA ID for ${patient}`);
		}
	}

	// Fee terms, set once (only while still at the defaults).
	const cruzTerms = await tx.practitionerClinic.updateMany({
		where: { practitionerId: cruz.id, clinicId: clinic.id, ewtRate: null },
		data: { ewtRate: 0.05 },
	});
	const reyesTerms = await tx.practitionerClinic.updateMany({
		where: { practitionerId: reyes.id, clinicId: clinic.id, clinicShareRate: 0 },
		data: { clinicShareRate: 0.2 },
	});
	if (cruzTerms.count + reyesTerms.count > 0) {
		done.push('professional fee terms');
	}

	if (!(await tx.cashierShift.count({ where: { clinicId: clinic.id, cashierId: cashier.id, closedAt: null } }))) {
		await tx.cashierShift.create({
			data: {
				clinicId: clinic.id,
				cashierId: cashier.id,
				openedAt: new Date(now.getTime() - 90 * MINUTE),
				openingCash: 2000,
			},
		});
		done.push("the cashier's open shift");
	}

	const queueDate = new Date(`${new Date(now.getTime() + 8 * 60 * MINUTE).toISOString().slice(0, 10)}T00:00:00Z`);
	if (!(await tx.queueTicket.count({ where: { clinicId: clinic.id, queueDate, station: 'CASHIER' } }))) {
		await sendPedroToTheCashier(tx, {
			clinic,
			reyesId: reyes.id,
			patientId: await patientId('pedro'),
			queueDate,
			now,
		});
		done.push("Pedro's visit at the cashier");
	}
	return done;
}

async function sendPedroToTheCashier(
	tx: Prisma.TransactionClient,
	opts: { clinic: { id: string; code: string }; reyesId: string; patientId: string; queueDate: Date; now: Date },
): Promise<void> {
	const sequences = new DocumentSequenceService(new DocumentSequenceRepository());
	const startedAt = new Date(opts.now.getTime() - 50 * MINUTE);
	const encounter = await tx.encounter.create({
		data: {
			encounterNo: await sequences.next(tx, opts.clinic, 'ENCOUNTER', startedAt),
			clinicId: opts.clinic.id,
			patientId: opts.patientId,
			practitionerId: opts.reyesId,
			type: 'FOLLOW_UP',
			status: 'FOR_BILLING',
			startedAt,
			chiefComplaint: 'Follow-up: weight loss and thirst',
			assessment: 'Type 2 diabetes mellitus, for glycemic control',
			plan: 'Fasting blood sugar today; continue metformin.',
		},
	});
	const fbs = await tx.diagnosticTest.findFirst({
		where: {
			organizationId: (await tx.clinic.findUniqueOrThrow({ where: { id: opts.clinic.id } })).organizationId,
			name: { contains: 'Fasting', mode: 'insensitive' },
		},
	});
	if (fbs) {
		await tx.diagnosticOrder.create({
			data: {
				orderNo: await sequences.next(tx, opts.clinic, 'LAB_ORDER', startedAt),
				encounterId: encounter.id,
				requestedById: opts.reyesId,
				clinicalInfo: 'T2DM, monitoring',
				createdAt: new Date(startedAt.getTime() + 20 * MINUTE),
				items: { create: { testId: fbs.id } },
			},
		});
	}
	const last = await tx.queueTicket.findFirst({
		where: { clinicId: opts.clinic.id, queueDate: opts.queueDate, prefix: 'A' },
		orderBy: { number: 'desc' },
	});
	await tx.queueTicket.create({
		data: {
			clinicId: opts.clinic.id,
			queueDate: opts.queueDate,
			prefix: 'A',
			number: (last?.number ?? 0) + 1,
			practitionerId: opts.reyesId,
			encounterId: encounter.id,
			station: 'CASHIER',
			status: 'WAITING',
			issuedAt: startedAt,
		},
	});
}
