import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { tagbilaranBarangayCode } from '../prisma/seed-reference.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicalTestApp, graphql, resetDatabase, signIn, useTestDatabase } from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createOrganization,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';

const PATIENT_FIELDS =
	'id organizationId patientNo givenName middleName familyName birthDate sex phone preferredLanguage barangay consentAt address { addressLine barangayCode barangayName } identifications { type idNumber label }';
const REGISTER = `mutation ($input: RegisterPatientInput!) {
	registerPatient(input: $input) {
		patient { ${PATIENT_FIELDS} }
		duplicates { patientId match visible matchedOn displayName birthYear }
	}
}`;
const LINK = `mutation ($input: LinkExistingPatientInput!) { linkExistingPatient(input: $input) { ${PATIENT_FIELDS} } }`;
const SEARCH = `query ($input: SearchPatientsInput!) { searchPatients(input: $input) { id givenName patientNo } }`;
const GET = `query ($id: ID!) { patient(id: $id) { id givenName } }`;
const UPDATE = `mutation ($input: UpdatePatientInput!) { updatePatient(input: $input) { ${PATIENT_FIELDS} } }`;
const ADD_ALLERGY = `mutation ($input: AddAllergyInput!) { addAllergy(input: $input) { id allergen type severity } }`;
const VOID_ALLERGY = `mutation ($input: VoidAllergyInput!) { voidAllergy(input: $input) { id voidedAt voidReason } }`;
const ALLERGIES = `query ($id: ID!) { patientAllergies(patientId: $id) { allergen } }`;

/**
 * Patients of an organization through GraphQL (DESIGN.md §5, §8): registration at one of the user's clinics as system
 * work (patient number, consent, care relationship, audit), row-level security on every read, duplicate checks within
 * the organization, contact details and allergies.
 */
describe('patients (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	/** A nurse at the scene's clinic, without a care relationship to anyone. */
	let nurse: FixtureUser;
	/** A doctor of another organization. */
	let outsider: FixtureUser;
	let outsiderClinicId: string;
	const cookies: Record<'doctor' | 'otherDoctor' | 'nurse' | 'outsider', string[]> = {
		doctor: [],
		otherDoctor: [],
		nurse: [],
		outsider: [],
	};
	let registeredId = '';

	const call = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		graphql(app, cookie, query, variables);

	const draft = (overrides: Record<string, unknown> = {}) => ({
		clinicId: scene.clinic.id,
		givenName: 'Lourdes',
		middleName: 'Garcia',
		familyName: 'Dela Cruz',
		birthDate: '1980-05-02',
		sex: 'FEMALE',
		phone: '0917 123 4567',
		philHealthId: '12-345678901-2',
		barangayCode: tagbilaranBarangayCode('Cogon'),
		addressLine: 'Purok 3',
		consentGiven: true,
		...overrides,
	});

	const register = async (cookie: string[], input: Record<string, unknown>) => {
		const res = await call(cookie, REGISTER, { input });
		expect(res.body.errors).toBeUndefined();
		return res.body.data.registerPatient;
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp();
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		await prisma.clinic.update({ where: { id: scene.clinic.id }, data: { cityMunicipalityCode: '0701242000' } });
		nurse = await createUser(prisma, { firstName: 'Nina', lastName: 'Santos' });
		await grantClinicRoles(prisma, scene.clinic.id, nurse.id, ['NURSE']);
		outsider = await createUser(prisma, { firstName: 'Lito', lastName: 'Lim' });
		const otherOrg = await createOrganization(prisma);
		outsiderClinicId = (
			await createClinic(prisma, {
				organizationId: otherOrg.id,
				staff: [{ userId: outsider.id, roles: ['DOCTOR'] }],
			})
		).id;
		cookies.doctor = await signIn(app, scene.doctor);
		cookies.otherDoctor = await signIn(app, scene.otherDoctor);
		cookies.nurse = await signIn(app, nurse);
		cookies.outsider = await signIn(app, outsider);
	});

	afterAll(async () => {
		await app?.close();
	});

	it('lists the clinics where the user registers patients', async () => {
		const res = await call(cookies.doctor, '{ myCareClinics { id code organizationId } }');
		expect(res.body.data.myCareClinics).toEqual([
			{ id: scene.clinic.id, code: scene.clinic.code, organizationId: scene.organization.id },
		]);
	});

	it('refuses a clinic the user does not work at, a registration without consent, and invalid fields', async () => {
		const elsewhere = await call(cookies.doctor, REGISTER, { input: draft({ clinicId: outsiderClinicId }) });
		expect(elsewhere.body.errors[0].extensions).toMatchObject({
			code: 'FORBIDDEN',
			errorCode: 'CLINIC_NOT_AVAILABLE',
		});
		const noConsent = await call(cookies.doctor, REGISTER, { input: draft({ consentGiven: false }) });
		expect(noConsent.body.errors[0].extensions.errorCode).toBe('CONSENT_REQUIRED');
		const badPhone = await call(cookies.doctor, REGISTER, { input: draft({ phone: '12345' }) });
		expect(badPhone.body.errors[0].extensions.errorCode).toBe('INVALID_PATIENT_DRAFT');
	});

	it('registers the patient with a patient number, PhilHealth ID, address, consent, care relationship and audit row', async () => {
		const { patient, duplicates } = await register(cookies.doctor, draft());
		expect(duplicates).toEqual([]);
		expect(patient).toMatchObject({
			organizationId: scene.organization.id,
			patientNo: expect.stringMatching(new RegExp(`^${scene.clinic.code}-PT-\\d{4}-000001$`)),
			givenName: 'Lourdes',
			middleName: 'Garcia',
			familyName: 'Dela Cruz',
			sex: 'FEMALE',
			phone: '+639171234567',
			preferredLanguage: 'en',
			barangay: 'Cogon',
			address: { addressLine: 'Purok 3', barangayCode: tagbilaranBarangayCode('Cogon'), barangayName: 'Cogon' },
			identifications: [{ type: 'PHILHEALTH_ID', idNumber: '12-345678901-2', label: 'PhilHealth' }],
		});
		expect(patient.consentAt).not.toBeNull();
		registeredId = patient.id;

		const consent = await prisma.patientConsent.findFirstOrThrow({ where: { patientId: registeredId } });
		expect(consent).toMatchObject({ type: 'DATA_PRIVACY', granted: true, witnessedById: scene.doctor.id });
		const care = await prisma.careRelationship.findMany({ where: { patientId: registeredId } });
		expect(care.map((row) => [row.userId, row.reason])).toEqual([[scene.doctor.id, 'ENCOUNTER']]);
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { event: 'patient.register' } });
		expect(audit).toMatchObject({
			action: 'CREATE',
			entityType: 'Patient',
			entityId: registeredId,
			userId: scene.doctor.id,
			patientId: registeredId,
			organizationId: scene.organization.id,
			clinicId: scene.clinic.id,
		});
	});

	it('shows the patient to the registering doctor, by name, patient no. and PhilHealth, and audits the view', async () => {
		for (const query of ['lourdes dela', '12-345678901-2']) {
			const res = await call(cookies.doctor, SEARCH, { input: { query } });
			expect(res.body.data.searchPatients.map((row: { id: string }) => row.id)).toEqual([registeredId]);
		}
		const { patientNo } = (await prisma.patient.findUniqueOrThrow({ where: { id: registeredId } })) ?? {};
		const byNumber = await call(cookies.doctor, SEARCH, { input: { query: patientNo } });
		expect(byNumber.body.data.searchPatients).toHaveLength(1);

		const res = await call(cookies.doctor, GET, { id: registeredId });
		expect(res.body.data.patient.givenName).toBe('Lourdes');
		const views = await prisma.auditLog.count({
			where: { event: 'patient.view', action: 'VIEW', userId: scene.doctor.id, patientId: registeredId },
		});
		expect(views).toBe(1);
	});

	it('hides the patient from a colleague without a care relationship and from another organization', async () => {
		for (const cookie of [cookies.otherDoctor, cookies.nurse, cookies.outsider]) {
			const res = await call(cookie, GET, { id: registeredId });
			expect(res.body.data.patient).toBeNull();
			const search = await call(cookie, SEARCH, { input: { query: 'Lourdes' } });
			expect(search.body.data.searchPatients).toEqual([]);
		}
	});

	it('never registers the same PhilHealth number twice in the organization, and shows a colleague only initials', async () => {
		const { patient, duplicates } = await register(
			cookies.otherDoctor,
			draft({ givenName: 'Lou', acknowledgeDuplicates: true }),
		);
		expect(patient).toBeNull();
		expect(duplicates).toEqual([
			{
				patientId: registeredId,
				match: 'EXACT_IDENTIFIER',
				visible: false,
				matchedOn: 'PhilHealth 12-345678901-2',
				displayName: 'L. D.',
				birthYear: 1980,
			},
		]);
	});

	it('never registers a patient number twice', async () => {
		const { patientNo } = await prisma.patient.findUniqueOrThrow({ where: { id: registeredId } });
		const { patient, duplicates } = await register(
			cookies.doctor,
			draft({ givenName: 'Other', philHealthId: null, patientNo, acknowledgeDuplicates: true }),
		);
		expect(patient).toBeNull();
		expect(duplicates[0]).toMatchObject({ match: 'EXACT_IDENTIFIER', matchedOn: `patient no. ${patientNo}` });
	});

	it('warns on the same name, birth date and sex, then registers once acknowledged', async () => {
		const input = draft({ philHealthId: null, phone: null });
		const first = await register(cookies.doctor, input);
		expect(first.patient).toBeNull();
		expect(first.duplicates).toEqual([expect.objectContaining({ match: 'NAME_BIRTH_SEX', visible: true })]);
		const second = await register(cookies.doctor, { ...input, acknowledgeDuplicates: true });
		expect(second.patient.patientNo).toMatch(/-000002$/);
	});

	it('links an existing patient the draft matches for a colleague, giving them a care relationship', async () => {
		const res = await call(cookies.otherDoctor, LINK, {
			input: { ...draft({ consentGiven: undefined }), consentGiven: true, patientId: registeredId },
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.linkExistingPatient.id).toBe(registeredId);
		const visible = await call(cookies.otherDoctor, GET, { id: registeredId });
		expect(visible.body.data.patient.id).toBe(registeredId);
		expect(await prisma.auditLog.count({ where: { event: 'patient.link', userId: scene.otherDoctor.id } })).toBe(1);
	});

	it('refuses to link a patient the details do not match', async () => {
		const res = await call(cookies.nurse, LINK, {
			input: { ...draft({ givenName: 'Someone', philHealthId: null }), patientId: registeredId },
		});
		expect(res.body.errors[0].extensions.errorCode).toBe('PATIENT_DOES_NOT_MATCH');
		expect((await call(cookies.nurse, GET, { id: registeredId })).body.data.patient).toBeNull();
	});

	it("changes a patient's contact details, with the barangay by name, and audits what changed", async () => {
		const res = await call(cookies.doctor, UPDATE, {
			input: {
				patientId: registeredId,
				phone: '0998 765 4321',
				preferredLanguage: 'Cebuano',
				barangay: 'Poblacion I',
			},
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.updatePatient).toMatchObject({
			phone: '+639987654321',
			preferredLanguage: 'ceb',
			barangay: 'Poblacion I',
			address: { addressLine: 'Purok 3' },
		});
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { event: 'patient.update' } });
		expect(audit.changes).toEqual({
			before: { phone: '+639171234567', preferredLanguage: 'en', barangay: 'Cogon' },
			after: { phone: '+639987654321', preferredLanguage: 'ceb', barangay: 'Poblacion I' },
		});

		const unknown = await call(cookies.doctor, UPDATE, {
			input: { patientId: registeredId, barangay: 'Atlantis' },
		});
		expect(unknown.body.errors[0].extensions.errorCode).toBe('UNKNOWN_BARANGAY');
		const nothing = await call(cookies.doctor, UPDATE, { input: { patientId: registeredId } });
		expect(nothing.body.errors[0].extensions.errorCode).toBe('NOTHING_TO_CHANGE');
		const hidden = await call(cookies.outsider, UPDATE, { input: { patientId: registeredId, phone: null } });
		expect(hidden.body.errors[0].extensions.errorCode).toBe('ENTITY_NOT_FOUND');
	});

	it('records an allergy and voids it with a reason, audited', async () => {
		const added = await call(cookies.doctor, ADD_ALLERGY, {
			input: { patientId: registeredId, allergen: ' Penicillin ', reaction: 'Hives', severity: 'MODERATE' },
		});
		expect(added.body.errors).toBeUndefined();
		expect(added.body.data.addAllergy).toMatchObject({
			allergen: 'Penicillin',
			type: 'DRUG',
			severity: 'MODERATE',
		});
		expect((await call(cookies.doctor, ALLERGIES, { id: registeredId })).body.data.patientAllergies).toEqual([
			{ allergen: 'Penicillin' },
		]);

		const tooShort = await call(cookies.doctor, VOID_ALLERGY, {
			input: { id: added.body.data.addAllergy.id, reason: 'x' },
		});
		expect(tooShort.body.errors[0].extensions.errorCode).toBe('INVALID_INPUT');
		const voided = await call(cookies.doctor, VOID_ALLERGY, {
			input: { id: added.body.data.addAllergy.id, reason: 'Entered on the wrong patient' },
		});
		expect(voided.body.data.voidAllergy.voidReason).toBe('Entered on the wrong patient');
		const again = await call(cookies.doctor, VOID_ALLERGY, {
			input: { id: added.body.data.addAllergy.id, reason: 'Entered on the wrong patient' },
		});
		expect(again.body.errors[0].extensions.errorCode).toBe('ALREADY_VOIDED');
		expect((await call(cookies.doctor, ALLERGIES, { id: registeredId })).body.data.patientAllergies).toEqual([]);
		const events = await prisma.auditLog.findMany({
			where: { entityType: 'PatientAllergy' },
			orderBy: { createdAt: 'asc' },
			select: { action: true, event: true, reason: true },
		});
		expect(events).toEqual([
			{ action: 'CREATE', event: 'allergy.add', reason: null },
			{ action: 'VOID', event: 'allergy.void', reason: 'Entered on the wrong patient' },
		]);
	});
});
