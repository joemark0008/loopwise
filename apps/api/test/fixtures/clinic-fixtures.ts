/**
 * Test fixtures: synthetic clinic data written straight through Prisma as the database owner (row-level security does
 * not apply), for e2e tests to set the scene before they exercise the API or `ClinicalDbService.asUser`.
 *
 * Every helper takes the Prisma client (`app.get(PrismaService)`) or a transaction, fills the required columns with
 * unique synthetic values, and lets the test override any of them. Synthetic data only.
 */
import crypto from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';

import { uuidv7 } from '../../src/common/uuid.js';
import type {
	CareRelationshipReason,
	Clinic,
	Encounter,
	EncounterStatus,
	EncounterType,
	Organization,
	OrgRole,
	Patient,
	Practitioner,
	Prisma,
	PrismaClient,
	Sex,
	StaffRole,
} from '../../src/generated/prisma/client.js';

export type FixtureDb = PrismaClient | Prisma.TransactionClient;

/** The password of every fixture user unless given (the demo seed's too). */
export const TEST_PASSWORD = 'test1234';

let counter = 0;
/** A short token unique within the test run (and across runs on the same database). */
export function uniqueToken(): string {
	counter += 1;
	return `${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

const passwordHashes = new Map<string, Promise<string>>();
/** better-auth's scrypt hash, cached per password (hashing is deliberately slow). */
function hashed(password: string): Promise<string> {
	let hash = passwordHashes.get(password);
	if (!hash) {
		hash = hashPassword(password);
		passwordHashes.set(password, hash);
	}
	return hash;
}

// -----------------------------------------------------------------------------
//  Users, organizations, clinics
// -----------------------------------------------------------------------------

export interface FixtureUser {
	id: string;
	email: string;
	name: string;
	/** The plain password, to sign in with `signIn(app, user)`. */
	password: string;
}

export interface CreateUserOptions {
	name?: string;
	email?: string;
	password?: string;
	firstName?: string;
	lastName?: string;
	isActive?: boolean;
	requiresPasswordReset?: boolean;
}

/** A user with a credential account (email + password sign-in), like the setup wizard and admins create. */
export async function createUser(db: FixtureDb, options: CreateUserOptions = {}): Promise<FixtureUser> {
	const token = uniqueToken();
	const firstName = options.firstName ?? 'Test';
	const lastName = options.lastName ?? `User ${token}`;
	const name = options.name ?? `${firstName} ${lastName}`;
	const email = options.email ?? `user.${token}@loopwise.test`;
	const password = options.password ?? TEST_PASSWORD;
	const id = uuidv7();
	await db.user.create({
		data: {
			id,
			email,
			name,
			firstName,
			lastName,
			emailVerified: true,
			isActive: options.isActive ?? true,
			requiresPasswordReset: options.requiresPasswordReset ?? false,
			messagingProviderCode: crypto.randomUUID().slice(0, 8),
			accounts: {
				create: { id: uuidv7(), accountId: id, providerId: 'credential', password: await hashed(password) },
			},
		},
	});
	return { id, email, name, password };
}

export interface CreateOrganizationOptions {
	name?: string;
	slug?: string;
	/** `organization_members` rows to add. */
	members?: readonly { userId: string; role?: OrgRole }[];
}

export async function createOrganization(
	db: FixtureDb,
	options: CreateOrganizationOptions = {},
): Promise<Organization> {
	const token = uniqueToken();
	const organization = await db.organization.create({
		data: { name: options.name ?? `Test Health Center ${token}`, slug: options.slug ?? `test-hc-${token}` },
	});
	for (const member of options.members ?? []) {
		await addOrganizationMember(db, organization.id, member.userId, member.role);
	}
	return organization;
}

export async function addOrganizationMember(
	db: FixtureDb,
	organizationId: string,
	userId: string,
	role: OrgRole = 'MEMBER',
): Promise<void> {
	await db.organizationMember.upsert({
		where: { organizationId_userId: { organizationId, userId } },
		create: { organizationId, userId, role },
		update: { role },
	});
}

export interface CreateClinicOptions {
	organizationId: string;
	name?: string;
	/** Short code for document numbers; unique per organization. */
	code?: string;
	/** The Wise workspace folder (`kind` is `local`, which requires a path). Default `./`. */
	path?: string;
	/** `user_clinic_roles` rows to add. */
	staff?: readonly { userId: string; roles: readonly StaffRole[] }[];
}

/** A clinic (a branch of the organization) that is also a local Wise workspace. */
export async function createClinic(db: FixtureDb, options: CreateClinicOptions): Promise<Clinic> {
	const token = uniqueToken();
	const clinic = await db.clinic.create({
		data: {
			organizationId: options.organizationId,
			name: options.name ?? `Test Clinic ${token}`,
			code: options.code ?? `T${token.slice(-5).toUpperCase()}`,
			kind: 'local',
			path: options.path ?? './',
		},
	});
	for (const member of options.staff ?? []) {
		await grantClinicRoles(db, clinic.id, member.userId, member.roles);
	}
	return clinic;
}

/** Gives the user these roles at the clinic (one `user_clinic_roles` row per role; existing rows are kept). */
export async function grantClinicRoles(
	db: FixtureDb,
	clinicId: string,
	userId: string,
	roles: readonly StaffRole[],
): Promise<void> {
	await db.userClinicRole.createMany({
		data: roles.map((role) => ({ clinicId, userId, role })),
		skipDuplicates: true,
	});
}

export interface CreatePractitionerOptions {
	/** The user who signs in as this practitioner (optional: visiting doctors have no account). */
	userId?: string;
	/** Clinics the practitioner works at (`practitioner_clinics`). */
	clinicIds?: readonly string[];
	firstName?: string;
	lastName?: string;
	title?: string;
	specialty?: string;
	prcLicenseNo?: string;
	s2LicenseNo?: string;
	ptrNo?: string;
}

/** A practitioner (PRC-licensed) record, linked to a user and clinics when given. */
export async function createPractitioner(
	db: FixtureDb,
	options: CreatePractitionerOptions = {},
): Promise<Practitioner> {
	const token = uniqueToken();
	const user = options.userId
		? await db.user.findUnique({ where: { id: options.userId }, select: { firstName: true, lastName: true } })
		: null;
	const practitioner = await db.practitioner.create({
		data: {
			userId: options.userId ?? null,
			title: options.title ?? 'Dr.',
			firstName: options.firstName ?? user?.firstName ?? 'Test',
			lastName: options.lastName ?? user?.lastName ?? `Doctor ${token}`,
			specialty: options.specialty ?? 'Family Medicine',
			prcLicenseNo: options.prcLicenseNo ?? `PRC-${token}`,
			s2LicenseNo: options.s2LicenseNo ?? null,
			ptrNo: options.ptrNo ?? `PTR-${token}`,
		},
	});
	if (options.clinicIds?.length) {
		await db.practitionerClinic.createMany({
			data: options.clinicIds.map((clinicId) => ({ practitionerId: practitioner.id, clinicId })),
			skipDuplicates: true,
		});
	}
	return practitioner;
}

// -----------------------------------------------------------------------------
//  Patients and encounters
// -----------------------------------------------------------------------------

export interface CreatePatientOptions {
	organizationId: string;
	patientNo?: string;
	firstName?: string;
	lastName?: string;
	middleName?: string;
	sex?: Sex;
	birthDate?: Date;
	mobileNo?: string;
	/** Users given a care relationship to the patient (default reason ENCOUNTER, no expiry). */
	careTeam?: readonly string[];
	/** Whether to record the RA 10173 data privacy consent (default true). */
	consent?: boolean;
}

/** A registered patient of the organization: a DATA_PRIVACY consent and care relationships for `careTeam`. */
export async function createPatient(db: FixtureDb, options: CreatePatientOptions): Promise<Patient> {
	const token = uniqueToken();
	const patient = await db.patient.create({
		data: {
			organizationId: options.organizationId,
			patientNo: options.patientNo ?? `P-${token}`,
			firstName: options.firstName ?? 'Juana',
			lastName: options.lastName ?? `Test ${token}`,
			middleName: options.middleName ?? null,
			sex: options.sex ?? 'FEMALE',
			birthDate: options.birthDate ?? new Date('1980-06-15T00:00:00Z'),
			mobileNo: options.mobileNo ?? null,
		},
	});
	if (options.consent ?? true) {
		await db.patientConsent.create({
			data: { patientId: patient.id, type: 'DATA_PRIVACY', version: '2026-01', granted: true },
		});
	}
	for (const userId of options.careTeam ?? []) {
		await addCareRelationship(db, { patientId: patient.id, userId, organizationId: options.organizationId });
	}
	return patient;
}

export interface CareRelationshipOptions {
	patientId: string;
	userId: string;
	organizationId: string;
	reason?: CareRelationshipReason;
	note?: string;
	expiresAt?: Date | null;
}

/** Lets the user reach the patient through row-level security (`app_can_see_patient`). */
export async function addCareRelationship(db: FixtureDb, options: CareRelationshipOptions): Promise<void> {
	await db.careRelationship.create({
		data: {
			patientId: options.patientId,
			userId: options.userId,
			organizationId: options.organizationId,
			reason: options.reason ?? 'ENCOUNTER',
			note: options.note ?? null,
			expiresAt: options.expiresAt ?? null,
		},
	});
}

export interface CreateEncounterOptions {
	clinicId: string;
	patientId: string;
	practitionerId?: string | null;
	encounterNo?: string;
	type?: EncounterType;
	status?: EncounterStatus;
	chiefComplaint?: string;
	startedAt?: Date;
	createdById?: string | null;
}

/** A visit at the clinic: the hub every clinical record hangs off. */
export function createEncounter(db: FixtureDb, options: CreateEncounterOptions): Promise<Encounter> {
	return db.encounter.create({
		data: {
			clinicId: options.clinicId,
			patientId: options.patientId,
			practitionerId: options.practitionerId ?? null,
			encounterNo: options.encounterNo ?? `E-${uniqueToken()}`,
			type: options.type ?? 'CONSULTATION',
			status: options.status ?? 'OPEN',
			chiefComplaint: options.chiefComplaint ?? 'Cough for three days',
			startedAt: options.startedAt ?? new Date(),
			createdById: options.createdById ?? null,
		},
	});
}

// -----------------------------------------------------------------------------
//  A whole scene
// -----------------------------------------------------------------------------

export interface ClinicScene {
	organization: Organization;
	clinic: Clinic;
	/** Org ADMIN; clinic SUPER_ADMIN + ADMIN + DOCTOR; a practitioner. */
	admin: FixtureUser;
	adminPractitioner: Practitioner;
	/** Clinic DOCTOR; a practitioner; in the patient's care team. */
	doctor: FixtureUser;
	doctorPractitioner: Practitioner;
	/** Clinic DOCTOR with no care relationship to the patient. */
	otherDoctor: FixtureUser;
	patient: Patient;
	/** An OPEN consultation of the patient with `doctor`. */
	encounter: Encounter;
}

/**
 * One organization with one clinic, an admin, a doctor with a patient (care relationship) and an open encounter, and
 * a second doctor without access to that patient. The quickest start for an access-control test.
 */
export async function createClinicScene(db: FixtureDb): Promise<ClinicScene> {
	const admin = await createUser(db, { firstName: 'Ana', lastName: 'Admin' });
	const doctor = await createUser(db, { firstName: 'Jose', lastName: 'Reyes' });
	const otherDoctor = await createUser(db, { firstName: 'Carlo', lastName: 'Cruz' });
	const organization = await createOrganization(db, { members: [{ userId: admin.id, role: 'ADMIN' }] });
	const clinic = await createClinic(db, {
		organizationId: organization.id,
		staff: [
			{ userId: admin.id, roles: ['SUPER_ADMIN', 'ADMIN', 'DOCTOR'] },
			{ userId: doctor.id, roles: ['DOCTOR'] },
			{ userId: otherDoctor.id, roles: ['DOCTOR'] },
		],
	});
	const adminPractitioner = await createPractitioner(db, { userId: admin.id, clinicIds: [clinic.id] });
	const doctorPractitioner = await createPractitioner(db, { userId: doctor.id, clinicIds: [clinic.id] });
	const patient = await createPatient(db, {
		organizationId: organization.id,
		firstName: 'Maria',
		lastName: 'Santos',
		careTeam: [doctor.id, admin.id],
	});
	const encounter = await createEncounter(db, {
		clinicId: clinic.id,
		patientId: patient.id,
		practitionerId: doctorPractitioner.id,
		createdById: doctor.id,
	});
	return {
		organization,
		clinic,
		admin,
		adminPractitioner,
		doctor,
		doctorPractitioner,
		otherDoctor,
		patient,
		encounter,
	};
}
