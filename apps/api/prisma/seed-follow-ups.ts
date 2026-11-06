import { addDays, dateColumn, manilaDate } from '../src/clinical/scheduling/manila-time.js';
import type { Disposition, Prisma, Sex } from '../src/generated/prisma/client.js';
import { daysAgo, type DemoContext, icd10 } from './seed-clinical.js';
import { PSGC_TAGBILARAN, tagbilaranBarangayCode } from './seed-reference.js';

/**
 * The follow-ups and referrals demo (synthetic): past visits whose follow-up dates are overdue, due today and coming
 * up, for the follow-up list, and referrals waiting for an answer, for the referral inbox and outbox.
 *
 * - Teresita Cabahug (new): Dr. Reyes 21 days ago, hypertension, follow-up a week overdue; referred out to an
 *   ophthalmologist (external, SENT: the referring side marks the answer).
 * - Roberto Lim (new): Dr. Reyes 4 days ago, type 2 diabetes, follow-up in 3 days, REFERRED to Dr. Cruz (internal,
 *   SENT: waiting for Dr. Cruz's answer in his inbox).
 * - Carmen Torres: Dr. Cruz 30 days ago, dyslipidemia, follow-up due today (her booking today is with Dr. Reyes, so
 *   it is still due with Dr. Cruz).
 *
 * The other demo patients' follow-up dates are already covered by their bookings. Runs once: skipped when Teresita is
 * already registered.
 */

/** What the seed needs of the demo (`DemoContext`, or the lookups of `run-seed-follow-ups.ts`). */
export type FollowUpSeedContext = Pick<
	DemoContext,
	'organizationId' | 'clinic' | 'staff' | 'practitioners' | 'nextNumber'
> & { patients: Pick<DemoContext['patients'], 'carmen'> };

const NEW_PATIENTS = [
	{
		key: 'teresita',
		firstName: 'Teresita',
		lastName: 'Cabahug',
		birthDate: '1968-07-19',
		sex: 'FEMALE',
		language: 'ceb',
		barangay: 'Taloto',
		mobile: '+639000000108',
	},
	{
		key: 'roberto',
		firstName: 'Roberto',
		lastName: 'Lim',
		birthDate: '1984-02-03',
		sex: 'MALE',
		language: 'en',
		barangay: 'Manga',
		mobile: '+639000000109',
	},
] as const satisfies readonly {
	key: string;
	firstName: string;
	lastName: string;
	birthDate: string;
	sex: Sex;
	language: string;
	barangay: string;
	mobile: string;
}[];

const MINUTE = 60_000;

/** Whether the follow-ups demo is in the database already. */
export async function hasFollowUpDemo(tx: Prisma.TransactionClient, organizationId: string): Promise<boolean> {
	return (
		(await tx.patient.count({
			where: { organizationId, firstName: 'Teresita', lastName: 'Cabahug', birthDate: dateColumn('1968-07-19') },
		})) > 0
	);
}

export async function seedFollowUps(tx: Prisma.TransactionClient, demo: FollowUpSeedContext): Promise<boolean> {
	if (await hasFollowUpDemo(tx, demo.organizationId)) {
		return false;
	}
	const today = manilaDate();
	const { doctor: reyes, internist: cruz } = demo.practitioners;

	const patients = {} as Record<(typeof NEW_PATIENTS)[number]['key'], string>;
	for (const [index, person] of NEW_PATIENTS.entries()) {
		const registeredAt = daysAgo(40 - index * 10);
		const created = await tx.patient.create({
			data: {
				organizationId: demo.organizationId,
				patientNo: await demo.nextNumber('PATIENT'),
				firstName: person.firstName,
				lastName: person.lastName,
				sex: person.sex,
				birthDate: dateColumn(person.birthDate),
				civilStatus: 'MARRIED',
				mobileNo: person.mobile,
				preferredLanguage: person.language,
				createdAt: registeredAt,
				addresses: {
					create: {
						type: 'HOME',
						addressLine: `${20 + index} Purok ${index + 2}`,
						barangayCode: tagbilaranBarangayCode(person.barangay),
						cityMunicipalityCode: PSGC_TAGBILARAN.code,
						zipCode: PSGC_TAGBILARAN.zipCode,
						isPrimary: true,
					},
				},
				identifications: {
					create: {
						type: 'PHILHEALTH_ID',
						idNumber: `SYN-0000-01${index + 8}`,
						issuedBy: 'PhilHealth (synthetic)',
					},
				},
				consents: {
					create: {
						type: 'DATA_PRIVACY',
						version: '2026-01',
						granted: true,
						signedBy: `${person.firstName} ${person.lastName}`,
						witnessedById: demo.staff.frontDesk,
						signedAt: registeredAt,
					},
				},
				careRelationships: {
					create: [
						{ userId: demo.staff.doctor, organizationId: demo.organizationId, reason: 'ENCOUNTER' },
						{ userId: demo.staff.admin, organizationId: demo.organizationId, reason: 'ENCOUNTER' },
					],
				},
			},
		});
		patients[person.key] = created.id;
	}

	/** A completed visit with its diagnosis, disposition and follow-up date. */
	const visit = async (spec: {
		patientId: string;
		practitionerId: string;
		createdById: string;
		daysAgo: number;
		followUpInDays: number;
		disposition: Disposition;
		chiefComplaint: string;
		assessment: string;
		plan: string;
		dx: string;
	}) => {
		const startedAt = daysAgo(spec.daysAgo);
		const encounter = await tx.encounter.create({
			data: {
				encounterNo: await demo.nextNumber('ENCOUNTER', startedAt),
				clinicId: demo.clinic.id,
				patientId: spec.patientId,
				practitionerId: spec.practitionerId,
				type: 'CONSULTATION',
				status: 'COMPLETED',
				startedAt,
				endedAt: new Date(startedAt.getTime() + 25 * MINUTE),
				chiefComplaint: spec.chiefComplaint,
				assessment: spec.assessment,
				plan: spec.plan,
				disposition: spec.disposition,
				followUpDate: dateColumn(addDays(today, spec.followUpInDays)),
				createdById: spec.createdById,
				createdAt: startedAt,
			},
		});
		await tx.encounterDiagnosis.create({
			data: {
				encounterId: encounter.id,
				...icd10(spec.dx),
				type: 'PRIMARY',
				sortOrder: 0,
				recordedById: spec.createdById,
			},
		});
		return encounter;
	};

	const teresita = await visit({
		patientId: patients.teresita,
		practitionerId: reyes,
		createdById: demo.staff.doctor,
		daysAgo: 21,
		followUpInDays: -7,
		disposition: 'FOR_FOLLOW_UP',
		chiefComplaint: 'Headache and blurred vision, BP 160/100',
		assessment: 'Hypertension, uncontrolled; rule out hypertensive retinopathy.',
		plan: 'Amlodipine 5 mg once daily. Eye exam. Return in 2 weeks with a BP log.',
		dx: 'I10',
	});
	const roberto = await visit({
		patientId: patients.roberto,
		practitionerId: reyes,
		createdById: demo.staff.doctor,
		daysAgo: 4,
		followUpInDays: 3,
		disposition: 'REFERRED',
		chiefComplaint: 'Thirst and frequent urination; FBS 182 mg/dL',
		assessment: 'Type 2 diabetes mellitus, newly diagnosed.',
		plan: 'Refer to internal medicine to start treatment. Diet counselling. Return in a week.',
		dx: 'E11.9',
	});
	const carmen = await visit({
		patientId: demo.patients.carmen,
		practitionerId: cruz,
		createdById: demo.staff.internist,
		daysAgo: 30,
		followUpInDays: 0,
		disposition: 'FOR_FOLLOW_UP',
		chiefComplaint: 'Lipid profile review',
		assessment: 'Dyslipidemia; LDL 168 mg/dL.',
		plan: 'Atorvastatin 20 mg at night. Repeat lipid profile and return in a month.',
		dx: 'E78.5',
	});
	// Dr. Cruz saw Carmen: he keeps her in his care.
	await tx.careRelationship.create({
		data: {
			patientId: demo.patients.carmen,
			userId: demo.staff.internist,
			organizationId: demo.organizationId,
			reason: 'ENCOUNTER',
		},
	});

	const external = await tx.referral.create({
		data: {
			encounterId: teresita.id,
			fromPractitionerId: reyes,
			toExternalDoctor: 'Dr. Lorna Pacana (synthetic)',
			toFacility: 'Bohol Eye Center (synthetic)',
			specialty: 'Ophthalmology',
			reason: 'Fundoscopy: rule out hypertensive retinopathy.',
			clinicalSummary: 'Headache and blurred vision for a week. BP 160/100 on the visit. No diabetes.',
			urgency: 'URGENT',
			status: 'SENT',
			referredAt: teresita.startedAt,
		},
	});
	const internal = await tx.referral.create({
		data: {
			encounterId: roberto.id,
			fromPractitionerId: reyes,
			toPractitionerId: cruz,
			specialty: 'Internal Medicine',
			reason: 'Newly diagnosed type 2 diabetes (FBS 182 mg/dL): please evaluate and start treatment.',
			clinicalSummary: 'Polydipsia and polyuria for a month, weight loss of 3 kg. BMI 27. No ketones.',
			urgency: 'ROUTINE',
			status: 'SENT',
			referredAt: roberto.startedAt,
		},
	});
	// An internal referral lets the doctor referred to open the patient.
	await tx.careRelationship.create({
		data: {
			patientId: patients.roberto,
			userId: demo.staff.internist,
			organizationId: demo.organizationId,
			reason: 'REFERRAL',
			note: `Referral from encounter ${roberto.encounterNo}`,
		},
	});

	await tx.auditLog.createMany({
		data: [
			...[teresita, roberto, carmen].map((encounter) => ({
				userId: encounter.createdById,
				organizationId: demo.organizationId,
				clinicId: demo.clinic.id,
				patientId: encounter.patientId,
				action: 'CREATE' as const,
				event: 'encounter.create',
				entityType: 'Encounter',
				entityId: encounter.id,
				origin: { via: 'seed' },
				createdAt: encounter.startedAt,
			})),
			...[
				{ referral: external, patientId: patients.teresita },
				{ referral: internal, patientId: patients.roberto },
			].map(({ referral, patientId }) => ({
				userId: demo.staff.doctor,
				organizationId: demo.organizationId,
				clinicId: demo.clinic.id,
				patientId,
				action: 'CREATE' as const,
				event: 'referral.create',
				entityType: 'Referral',
				entityId: referral.id,
				origin: { via: 'seed' },
				createdAt: referral.referredAt,
			})),
		],
	});
	return true;
}
