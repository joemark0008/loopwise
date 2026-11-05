import crypto from 'node:crypto';

import { findIcd10 } from '@loopwise/shared/icd10';

import { defaultUserGroupValues } from '../src/clinical/clinics/clinics/default-user-group.js';
import { DocumentSequenceRepository } from '../src/clinical/clinics/document-sequences/document-sequence.repository.js';
import {
	type DocumentSequenceKey,
	DocumentSequenceService,
} from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import { uuidv7 } from '../src/common/uuid.js';
import type {
	Disposition,
	EncounterStatus,
	EncounterType,
	Prisma,
	Sex,
	StaffRole,
} from '../src/generated/prisma/client.js';
import { PSGC_TAGBILARAN, tagbilaranBarangayCode } from './seed-reference.js';

/**
 * The synthetic demo (DESIGN.md §5): one organization, Tagbilaran City Health Center, with one clinic (`TAG`) that is
 * also the Wise workspace; its staff (one login per desk), three practitioners, and synthetic patients with their
 * visits. Everything here is invented; never put real patient data in a seed. The encounters' records (notes, vitals,
 * diagnoses, documents) are filled by `seed-encounter-record.ts` and `seed-trends.ts`; diagnostics and billing add
 * theirs from their own seed files (see `seed.ts`).
 *
 * For the other seeds: find a patient by `DEMO_PATIENTS.<key>.patientNo` (unique per organization), the clinic by
 * `DEMO_CLINIC_CODE` within the organization `DEMO_ORG_SLUG`, staff by `DEMO_STAFF.<key>` (email). Maria Santos's
 * latest encounter is `demoEncounterOf(tx, 'maria')` (her first full visit, 12 days ago; her year of check-ups is
 * older), and `demoEncounterOf(tx, key, 'earliest')` gives a patient's first visit.
 */

export const DEMO_PASSWORD = 'test1234';
export const DEMO_ORG_SLUG = 'tagbilaran-hc';
export const DEMO_ORG_NAME = 'Tagbilaran City Health Center';
export const DEMO_CLINIC_CODE = 'TAG';
export const DEMO_CLINIC_NAME = 'Tagbilaran City Health Center';

/** The demo logins (all share `DEMO_PASSWORD`), by desk. */
export const DEMO_STAFF = {
	admin: 'test@test.test',
	doctor: 'dr.reyes@loopwise.test',
	nurse: 'nurse.santos@loopwise.test',
	medtech: 'lab.bautista@loopwise.test',
	internist: 'dr.cruz@loopwise.test',
	pharmacist: 'pharm.garcia@loopwise.test',
	cashier: 'cashier.dela.cruz@loopwise.test',
	frontDesk: 'front.desk@loopwise.test',
} as const;

export type DemoStaffKey = keyof typeof DEMO_STAFF;

/** Who each login is: their name, clinic roles at `TAG` and organization role. */
export const STAFF: readonly {
	key: DemoStaffKey;
	firstName: string;
	lastName: string;
	name: string;
	roles: StaffRole[];
	orgRole: 'ADMIN' | 'MEMBER';
}[] = [
	{
		key: 'admin',
		firstName: 'Test',
		lastName: 'Admin',
		name: 'Test',
		roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'],
		orgRole: 'ADMIN',
	},
	{ key: 'doctor', firstName: 'Ana', lastName: 'Reyes', name: 'Dr. Ana Reyes', roles: ['DOCTOR'], orgRole: 'MEMBER' },
	{
		key: 'nurse',
		firstName: 'Joy',
		lastName: 'Santos',
		name: 'Nurse Joy Santos',
		roles: ['NURSE'],
		orgRole: 'MEMBER',
	},
	{
		key: 'medtech',
		firstName: 'Mark',
		lastName: 'Bautista',
		name: 'Mark Bautista (Lab)',
		roles: ['MEDTECH'],
		orgRole: 'MEMBER',
	},
	{
		key: 'internist',
		firstName: 'Paolo',
		lastName: 'Cruz',
		name: 'Dr. Paolo Cruz (Internal Medicine)',
		roles: ['DOCTOR'],
		orgRole: 'MEMBER',
	},
	{
		key: 'pharmacist',
		firstName: 'Lea',
		lastName: 'Garcia',
		name: 'Lea Garcia (Pharmacy)',
		roles: ['PHARMACIST'],
		orgRole: 'MEMBER',
	},
	{
		key: 'cashier',
		firstName: 'Rosa',
		lastName: 'Dela Cruz',
		name: 'Rosa Dela Cruz (Cashier)',
		roles: ['CASHIER'],
		orgRole: 'MEMBER',
	},
	{
		key: 'frontDesk',
		firstName: 'Nina',
		lastName: 'Flores',
		name: 'Nina Flores (Front desk)',
		roles: ['RECEPTIONIST'],
		orgRole: 'MEMBER',
	},
];

/** Practitioner profiles of the doctors. PRC, PTR and PhilHealth numbers are made up. */
const PRACTITIONERS = [
	{
		key: 'admin',
		title: 'Dr.',
		postNominals: 'MD',
		sex: 'MALE',
		specialty: 'Family Medicine',
		prcLicenseNo: '0000003',
		ptrNo: '9000003',
		philhealthPan: 'SYN-PAN-0003',
	},
	{
		key: 'doctor',
		title: 'Dra.',
		postNominals: 'MD',
		sex: 'FEMALE',
		specialty: 'Family Medicine',
		prcLicenseNo: '0000001',
		ptrNo: '9000001',
		philhealthPan: 'SYN-PAN-0001',
	},
	{
		key: 'internist',
		title: 'Dr.',
		postNominals: 'MD, FPCP',
		sex: 'MALE',
		specialty: 'Internal Medicine',
		prcLicenseNo: '0000002',
		ptrNo: '9000002',
		philhealthPan: 'SYN-PAN-0002',
	},
] as const satisfies readonly {
	key: DemoStaffKey;
	title: string;
	postNominals: string;
	sex: Sex;
	specialty: string;
	prcLicenseNo: string;
	ptrNo: string;
	philhealthPan: string;
}[];

export type DemoPractitionerKey = (typeof PRACTITIONERS)[number]['key'];

/** The synthetic patients, in registration order (their patient numbers follow it). */
const PATIENTS = [
	{
		key: 'maria',
		firstName: 'Maria',
		lastName: 'Santos',
		birthDate: '1981-04-12',
		sex: 'FEMALE',
		language: 'ceb',
		barangay: 'Cogon',
	},
	{
		key: 'jose',
		firstName: 'Jose',
		lastName: 'Ramos',
		birthDate: '1966-09-03',
		sex: 'MALE',
		language: 'fil',
		barangay: 'Dao',
	},
	{
		key: 'liza',
		firstName: 'Liza',
		lastName: 'Mendoza',
		birthDate: '1973-02-21',
		sex: 'FEMALE',
		language: 'en',
		barangay: 'Cogon',
	},
	{
		key: 'pedro',
		firstName: 'Pedro',
		lastName: 'Villanueva',
		birthDate: '1963-11-30',
		sex: 'MALE',
		language: 'ceb',
		barangay: 'Booy',
	},
	{
		key: 'ana',
		firstName: 'Ana',
		lastName: 'Lopez',
		birthDate: '1978-06-15',
		sex: 'FEMALE',
		language: 'fil',
		barangay: 'Manga',
	},
	{
		key: 'carmen',
		firstName: 'Carmen',
		lastName: 'Torres',
		birthDate: '1975-12-01',
		sex: 'FEMALE',
		language: 'en',
		barangay: 'Dao',
	},
	{
		key: 'ramon',
		firstName: 'Ramon',
		lastName: 'Gonzaga',
		birthDate: '1959-03-08',
		sex: 'MALE',
		language: 'ceb',
		barangay: 'Taloto',
	},
] as const satisfies readonly {
	key: string;
	firstName: string;
	lastName: string;
	birthDate: string;
	sex: Sex;
	language: string;
	barangay: string;
}[];

export type DemoPatientKey = (typeof PATIENTS)[number]['key'];

/** The patients' numbers: issued in registration order by the `TAG` PATIENT sequence of the current year. */
export const DEMO_PATIENTS: Record<DemoPatientKey, { patientNo: string; firstName: string; lastName: string }> =
	Object.fromEntries(
		PATIENTS.map((patient, index) => [
			patient.key,
			{
				patientNo: `${DEMO_CLINIC_CODE}-PT-${demoYear()}-${String(index + 1).padStart(6, '0')}`,
				firstName: patient.firstName,
				lastName: patient.lastName,
			},
		]),
	) as Record<DemoPatientKey, { patientNo: string; firstName: string; lastName: string }>;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
export const daysAgo = (days: number, now = Date.now()) => new Date(now - days * DAY);
/** A `@db.Date` value: the calendar day of `date` in UTC. */
export const dateOnly = (date: Date) => new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`);

/** Maria Santos's first full visit, 12 days ago; her year of check-ups is counted back from it. */
const MARIA_FIRST_VISIT_DAYS_AGO = 12;

/**
 * Every demo visit, by key. `daysAgo` counts from now; Maria's check-ups count back from her first full visit. All at
 * `TAG` with Dr. Reyes. Past visits are COMPLETED; today Jose is with the doctor and Ramon waits after triage.
 */
const ENCOUNTERS = {
	mariaCheckup1: {
		patient: 'maria',
		daysAgo: MARIA_FIRST_VISIT_DAYS_AGO + 360,
		type: 'CONSULTATION',
		chiefComplaint: 'Annual check-up',
	},
	mariaCheckup2: {
		patient: 'maria',
		daysAgo: MARIA_FIRST_VISIT_DAYS_AGO + 270,
		type: 'FOLLOW_UP',
		chiefComplaint: 'Follow-up of BP reading',
	},
	mariaCheckup3: {
		patient: 'maria',
		daysAgo: MARIA_FIRST_VISIT_DAYS_AGO + 180,
		type: 'FOLLOW_UP',
		chiefComplaint: 'Fasting blood sugar review',
	},
	mariaCheckup4: {
		patient: 'maria',
		daysAgo: MARIA_FIRST_VISIT_DAYS_AGO + 90,
		type: 'FOLLOW_UP',
		chiefComplaint: 'Headache, BP check',
	},
	mariaFirstVisit: {
		patient: 'maria',
		daysAgo: MARIA_FIRST_VISIT_DAYS_AGO,
		type: 'CONSULTATION',
		chiefComplaint: 'Fatigue, frequent urination, BP 140/90',
		disposition: 'REFERRED',
		followUpInDays: 14,
	},
	ramonVisit: {
		patient: 'ramon',
		daysAgo: 40,
		type: 'FOLLOW_UP',
		chiefComplaint: 'Hypertension follow-up',
		disposition: 'FOR_FOLLOW_UP',
		followUpInDays: 14,
	},
	joseCheckup: { patient: 'jose', daysAgo: 20, type: 'CONSULTATION', chiefComplaint: 'Annual check-up' },
	anaVisit: {
		patient: 'ana',
		daysAgo: 9,
		type: 'FOLLOW_UP',
		chiefComplaint: 'Follow-up, family history of diabetes',
		disposition: 'FOR_FOLLOW_UP',
		followUpInDays: 14,
	},
	lizaVisit: {
		patient: 'liza',
		daysAgo: 8,
		type: 'CONSULTATION',
		chiefComplaint: 'Breast screening',
		disposition: 'REFERRED',
	},
	carmenVisit: { patient: 'carmen', daysAgo: 6, type: 'CONSULTATION', chiefComplaint: 'Routine screening' },
	pedroVisit: {
		patient: 'pedro',
		daysAgo: 3,
		type: 'CONSULTATION',
		chiefComplaint: 'Weight loss, thirst',
		disposition: 'FOR_FOLLOW_UP',
		followUpInDays: 7,
	},
	joseToday: {
		patient: 'jose',
		daysAgo: 0.05,
		type: 'CONSULTATION',
		chiefComplaint: 'Sore throat and fever for 3 days',
		status: 'IN_PROGRESS',
	},
	ramonToday: {
		patient: 'ramon',
		daysAgo: 0.02,
		type: 'FOLLOW_UP',
		chiefComplaint: 'BP check, ran out of maintenance medicines',
		status: 'OPEN',
	},
} as const satisfies Record<
	string,
	{
		patient: DemoPatientKey;
		daysAgo: number;
		type: EncounterType;
		chiefComplaint: string;
		status?: EncounterStatus;
		disposition?: Disposition;
		followUpInDays?: number;
	}
>;

export type DemoEncounterKey = keyof typeof ENCOUNTERS;

/** What the other demo seeds build on: the ids created here. */
export interface DemoContext {
	organizationId: string;
	clinic: { id: string; code: string; name: string };
	staff: Record<DemoStaffKey, string>;
	practitioners: Record<DemoPractitionerKey, string>;
	patients: Record<DemoPatientKey, string>;
	encounters: Record<DemoEncounterKey, { id: string; patientId: string; startedAt: Date }>;
	/** Issues document numbers (`TAG-RX-2026-000001` …) on the seed's transaction. */
	nextNumber: (key: DocumentSequenceKey, at?: Date) => Promise<string>;
}

/** A random verification code for a printed document (the QR a pharmacy or employer checks). */
export const verificationCode = () => crypto.randomBytes(8).toString('hex').toUpperCase();

/**
 * Creates the organization, the clinic, the staff logins and roles, the practitioners, the patients and their visits.
 * Runs as system work in the caller's transaction. Returns null when the demo organization is already there.
 */
export async function seedClinicalDemo(
	tx: Prisma.TransactionClient,
	opts: { passwordHash: string; clinicPath: string },
): Promise<DemoContext | null> {
	if (await tx.organization.findUnique({ where: { slug: DEMO_ORG_SLUG } })) {
		return null;
	}
	const sequences = new DocumentSequenceService(new DocumentSequenceRepository());

	const organization = await tx.organization.create({
		data: { name: DEMO_ORG_NAME, tradeName: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG },
	});
	const clinic = await tx.clinic.create({
		data: {
			organizationId: organization.id,
			code: DEMO_CLINIC_CODE,
			name: DEMO_CLINIC_NAME,
			addressLine: 'CPG Avenue',
			barangayCode: tagbilaranBarangayCode('Cogon'),
			cityMunicipalityCode: PSGC_TAGBILARAN.code,
			zipCode: PSGC_TAGBILARAN.zipCode,
			contactNo: '(038) 000-0101',
			kind: 'local',
			path: opts.clinicPath,
		},
	});
	await tx.userGroup.create({ data: defaultUserGroupValues(clinic.id) });
	const nextNumber = (key: DocumentSequenceKey, at?: Date) => sequences.next(tx, clinic, key, at);

	const staff = {} as Record<DemoStaffKey, string>;
	for (const person of STAFF) {
		const email = DEMO_STAFF[person.key];
		const existing = await tx.user.findUnique({ where: { email } });
		const userId = existing?.id ?? uuidv7();
		if (!existing) {
			await tx.user.create({
				data: {
					id: userId,
					email,
					name: person.name,
					firstName: person.firstName,
					lastName: person.lastName,
					emailVerified: true,
					// better-auth's credential account: its account id is the user id.
					accounts: { create: { accountId: userId, providerId: 'credential', password: opts.passwordHash } },
				},
			});
		}
		staff[person.key] = userId;
		await tx.organizationMember.create({
			data: { organizationId: organization.id, userId, role: person.orgRole },
		});
		await tx.userClinicRole.createMany({
			data: person.roles.map((role) => ({ userId, clinicId: clinic.id, role })),
			skipDuplicates: true,
		});
	}

	const practitioners = {} as Record<DemoPractitionerKey, string>;
	for (const { key, ...credentials } of PRACTITIONERS) {
		const person = STAFF.find((candidate) => candidate.key === key)!;
		const practitioner = await tx.practitioner.create({
			data: {
				userId: staff[key],
				type: 'PHYSICIAN',
				firstName: person.firstName,
				lastName: person.lastName,
				email: DEMO_STAFF[key],
				ptrIssuedAt: 'Tagbilaran City',
				ptrIssuedDate: new Date(`${demoYear()}-01-05T00:00:00Z`),
				...credentials,
				clinics: { create: { clinicId: clinic.id, roomName: key === 'internist' ? 'Room 2' : 'Room 1' } },
			},
		});
		practitioners[key] = practitioner.id;
	}

	const encounterSpecs = Object.entries(ENCOUNTERS) as [DemoEncounterKey, (typeof ENCOUNTERS)[DemoEncounterKey]][];
	const now = Date.now();
	const startOf = (key: DemoEncounterKey) => daysAgo(ENCOUNTERS[key].daysAgo, now);

	const patients = {} as Record<DemoPatientKey, string>;
	for (const [index, person] of PATIENTS.entries()) {
		const number = String(index + 1).padStart(4, '0');
		const firstVisit = Math.max(
			...encounterSpecs.filter(([, spec]) => spec.patient === person.key).map(([, spec]) => spec.daysAgo),
		);
		const registeredAt = daysAgo(firstVisit, now);
		const created = await tx.patient.create({
			data: {
				organizationId: organization.id,
				// The current year's sequence, so `DEMO_PATIENTS` can name the numbers.
				patientNo: await nextNumber('PATIENT'),
				firstName: person.firstName,
				lastName: person.lastName,
				sex: person.sex,
				birthDate: new Date(`${person.birthDate}T00:00:00Z`),
				civilStatus: 'MARRIED',
				mobileNo: `+639000000${number.slice(1)}`,
				preferredLanguage: person.language,
				createdAt: registeredAt,
				addresses: {
					create: {
						type: 'HOME',
						addressLine: `${10 + index} Purok ${index + 1}`,
						barangayCode: tagbilaranBarangayCode(person.barangay),
						cityMunicipalityCode: PSGC_TAGBILARAN.code,
						zipCode: PSGC_TAGBILARAN.zipCode,
						isPrimary: true,
					},
				},
				identifications: {
					create: {
						type: 'PHILHEALTH_ID',
						idNumber: `SYN-0000-${number}`,
						issuedBy: 'PhilHealth (synthetic)',
					},
				},
				consents: {
					create: {
						type: 'DATA_PRIVACY',
						version: '2026-01',
						granted: true,
						signedBy: `${person.firstName} ${person.lastName}`,
						witnessedById: staff.frontDesk,
						signedAt: registeredAt,
					},
				},
				careRelationships: {
					create: [
						{ userId: staff.doctor, organizationId: organization.id, reason: 'ENCOUNTER' },
						{ userId: staff.admin, organizationId: organization.id, reason: 'ENCOUNTER' },
					],
				},
			},
		});
		patients[person.key] = created.id;
	}

	// Oldest first, so encounter numbers follow the visits within each year.
	const encounters = {} as DemoContext['encounters'];
	for (const [key, spec] of [...encounterSpecs].sort(([, a], [, b]) => b.daysAgo - a.daysAgo)) {
		const startedAt = startOf(key);
		const status: EncounterStatus = 'status' in spec ? spec.status : 'COMPLETED';
		const followUpInDays = 'followUpInDays' in spec ? spec.followUpInDays : undefined;
		const encounter = await tx.encounter.create({
			data: {
				encounterNo: await nextNumber('ENCOUNTER', startedAt),
				clinicId: clinic.id,
				patientId: patients[spec.patient],
				practitionerId: practitioners.doctor,
				type: spec.type,
				status,
				startedAt,
				endedAt: status === 'COMPLETED' ? new Date(startedAt.getTime() + 30 * MINUTE) : null,
				chiefComplaint: spec.chiefComplaint,
				disposition: status === 'COMPLETED' ? ('disposition' in spec ? spec.disposition : 'SENT_HOME') : null,
				followUpDate:
					followUpInDays === undefined
						? null
						: dateOnly(new Date(startedAt.getTime() + followUpInDays * DAY)),
				createdById: staff.doctor,
				createdAt: startedAt,
			},
		});
		encounters[key] = { id: encounter.id, patientId: encounter.patientId, startedAt };
	}

	return {
		organizationId: organization.id,
		clinic: { id: clinic.id, code: clinic.code, name: clinic.name },
		staff,
		practitioners,
		patients,
		encounters,
		nextNumber,
	};
}

/** A diagnosis row's code and its ICD-10 title (the curated list, which `seedReference` loads into `icd10_codes`). */
export function icd10(code: string): { icd10Code: string; description: string } {
	const entry = findIcd10(code);
	if (!entry) {
		throw new Error(`ICD-10 code ${code} is not in the curated list`);
	}
	return { icd10Code: entry.code, description: entry.title };
}

/** A patient's latest (or earliest) demo encounter, found by patient number: for the other areas' seeds. */
export function demoEncounterOf(
	tx: Prisma.TransactionClient,
	patient: DemoPatientKey,
	which: 'latest' | 'earliest' = 'latest',
) {
	return tx.encounter.findFirst({
		where: {
			patient: { patientNo: DEMO_PATIENTS[patient].patientNo, organization: { slug: DEMO_ORG_SLUG } },
			status: { not: 'CANCELLED' },
			...(which === 'latest' && { startedAt: { lte: new Date() } }),
		},
		orderBy: { startedAt: which === 'latest' ? 'desc' : 'asc' },
	});
}

/** The demo's year for patient numbers (Asia/Manila, as `DocumentSequenceService` counts it). */
function demoYear(): number {
	return new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();
}
