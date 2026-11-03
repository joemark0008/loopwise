import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const PATIENT_FIELDS =
	'id givenName familyName birthDate sex phone consentAt identifiers { system value facility { name } }';
const REGISTER = `mutation ($input: RegisterPatientInput!) {
	registerPatient(input: $input) {
		patient { ${PATIENT_FIELDS} }
		duplicates { patientId match visible matchedOn displayName birthYear facilityNames }
	}
}`;
const LINK = `mutation ($input: LinkExistingPatientInput!) { linkExistingPatient(input: $input) { ${PATIENT_FIELDS} } }`;
const SEARCH = `query ($input: SearchPatientsInput!) { searchPatients(input: $input) { id givenName } }`;
const GET = `query ($id: ID!) { patient(id: $id) { id givenName } }`;

/**
 * Patient registration through GraphQL (DESIGN.md §7, §10): system work that grants the registering clinician a care
 * relationship, with row-level security on every read and deterministic duplicate checks.
 */
describe('patient registration (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		santos: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
	};
	const facilities = { healthCenter: '', hospital: '' };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	const draft = (overrides: Record<string, unknown> = {}) => ({
		facilityId: facilities.healthCenter,
		givenName: 'Maria',
		familyName: 'Dela Cruz',
		birthDate: '1980-05-02',
		sex: 'female',
		phone: '0917 123 4567',
		mrn: 'THC-9001',
		philHealthId: '12-345678901-2',
		consentGiven: true,
		...overrides,
	});

	const register = async (cookie: string[], input: Record<string, unknown>) => {
		const res = await graphql(cookie, REGISTER, { input });
		expect(res.body.errors).toBeUndefined();
		return res.body.data.registerPatient;
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);

		const password = 'Sup3r-secret!';
		for (const [key, email] of [
			['reyes', 'reyes@example.com'],
			['santos', 'santos@example.com'],
			['cruz', 'cruz@example.com'],
		] as const) {
			const user = await createTestUser(app, { name: key, email, password });
			users[key] = { cookie: user.cookie, id: user.userId };
		}

		// The workspace organization owns the project, as in the seed: it is not a facility.
		const workspace = await prisma.organization.findFirstOrThrow();
		await prisma.project.create({ data: { name: 'Loopwise', type: 'local', path: '/tmp/x', orgId: workspace.id } });
		facilities.healthCenter = (
			await prisma.organization.create({ data: { name: 'Health Center', slug: 'hc', type: 'clinic' } })
		).id;
		facilities.hospital = (
			await prisma.organization.create({ data: { name: 'Regional Hospital', slug: 'rh', type: 'hospital' } })
		).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: workspace.id, userId: users.reyes.id, role: 'user' },
				{ orgId: facilities.healthCenter, userId: users.reyes.id, role: 'user' },
				{ orgId: facilities.healthCenter, userId: users.santos.id, role: 'user' },
				{ orgId: facilities.hospital, userId: users.cruz.id, role: 'user' },
			],
			skipDuplicates: true,
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	let mariaId = '';

	it('lists only real facilities as the places a user can register at', async () => {
		const res = await graphql(users.reyes.cookie, '{ myFacilities { id name } }');
		expect(res.body.data.myFacilities).toEqual([{ id: facilities.healthCenter, name: 'Health Center' }]);
	});

	it('refuses a facility the user does not work at, and a registration without consent', async () => {
		const elsewhere = await graphql(users.reyes.cookie, REGISTER, {
			input: draft({ facilityId: facilities.hospital }),
		});
		expect(elsewhere.body.errors?.[0].extensions.code).toBe('FORBIDDEN');

		const noConsent = await graphql(users.reyes.cookie, REGISTER, { input: draft({ consentGiven: false }) });
		expect(noConsent.body.errors?.[0].extensions.code).toBe('BAD_REQUEST');

		const invalid = await graphql(users.reyes.cookie, REGISTER, { input: draft({ birthDate: '2999-01-01' }) });
		expect(invalid.body.errors?.[0].message).toMatch(/future/);
		expect(await prisma.patient.count()).toBe(0);
	});

	it('registers the patient with identifiers, a care relationship, consent and an audit row', async () => {
		const { patient, duplicates } = await register(users.reyes.cookie, draft());
		expect(duplicates).toEqual([]);
		expect(patient).toMatchObject({
			givenName: 'Maria',
			familyName: 'Dela Cruz',
			birthDate: '1980-05-02',
			sex: 'female',
			phone: '+639171234567',
			consentAt: expect.any(String),
		});
		expect(patient.identifiers).toEqual(
			expect.arrayContaining([
				{ system: 'MRN', value: 'THC-9001', facility: { name: 'Health Center' } },
				{ system: 'PhilHealth', value: '12-345678901-2', facility: { name: 'Health Center' } },
			]),
		);
		mariaId = patient.id;

		expect(await prisma.careRelationship.findMany({ where: { patientId: mariaId } })).toEqual([
			expect.objectContaining({ userId: users.reyes.id, orgId: facilities.healthCenter, reason: 'encounter' }),
		]);
		expect(await prisma.auditLog.findMany({ where: { patientId: mariaId, action: 'patient.register' } })).toEqual([
			expect.objectContaining({ userId: users.reyes.id, orgId: facilities.healthCenter, resource: 'patient' }),
		]);
	});

	it('shows the patient to the registering doctor, in search and by id, and audits the view', async () => {
		const byName = await graphql(users.reyes.cookie, SEARCH, { input: { query: 'maria dela' } });
		expect(byName.body.data.searchPatients).toEqual([{ id: mariaId, givenName: 'Maria' }]);
		const byMrn = await graphql(users.reyes.cookie, SEARCH, { input: { query: 'thc-9001' } });
		expect(byMrn.body.data.searchPatients).toEqual([{ id: mariaId, givenName: 'Maria' }]);

		const byId = await graphql(users.reyes.cookie, GET, { id: mariaId });
		expect(byId.body.data.patient).toEqual({ id: mariaId, givenName: 'Maria' });
		expect(await prisma.auditLog.count({ where: { patientId: mariaId, action: 'patient.view' } })).toBe(1);
	});

	it('hides the patient from a doctor at another facility', async () => {
		const search = await graphql(users.cruz.cookie, SEARCH, { input: { query: 'Maria' } });
		expect(search.body.data.searchPatients).toEqual([]);
		const byId = await graphql(users.cruz.cookie, GET, { id: mariaId });
		expect(byId.body.data.patient).toBeNull();
	});

	it('never registers the same MRN twice at the facility, and shows a colleague only initials', async () => {
		const { patient, duplicates } = await register(
			users.santos.cookie,
			draft({ givenName: 'Other', familyName: 'Person', philHealthId: null, acknowledgeDuplicates: true }),
		);
		expect(patient).toBeNull();
		expect(duplicates).toEqual([
			{
				patientId: mariaId,
				match: 'EXACT_IDENTIFIER',
				visible: false,
				matchedOn: 'MRN THC-9001',
				displayName: 'M. D.',
				birthYear: 1980,
				facilityNames: ['Health Center'],
			},
		]);
	});

	it('warns on the same name, birth date and sex, then registers once acknowledged', async () => {
		const twin = draft({ givenName: ' MARIA ', mrn: 'THC-9002', philHealthId: null, phone: null });
		const warned = await register(users.reyes.cookie, twin);
		expect(warned.patient).toBeNull();
		expect(warned.duplicates).toEqual([
			expect.objectContaining({ match: 'NAME_BIRTH_SEX', visible: true, displayName: 'Maria Dela Cruz' }),
		]);

		const registered = await register(users.reyes.cookie, { ...twin, acknowledgeDuplicates: true });
		expect(registered.patient.givenName).toBe('MARIA');
	});

	it('matches PhilHealth across facilities and links the existing patient for the other facility', async () => {
		const atHospital = draft({
			facilityId: facilities.hospital,
			givenName: 'Maria',
			mrn: 'BRH-0001',
			philHealthId: '12-345678901-2',
		});
		const { patient, duplicates } = await register(users.cruz.cookie, atHospital);
		expect(patient).toBeNull();
		expect(duplicates).toContainEqual(
			expect.objectContaining({
				patientId: mariaId,
				match: 'EXACT_IDENTIFIER',
				matchedOn: 'PhilHealth 12-345678901-2',
				visible: false,
			}),
		);

		const linked = await graphql(users.cruz.cookie, LINK, { input: { ...atHospital, patientId: mariaId } });
		expect(linked.body.errors).toBeUndefined();
		expect(linked.body.data.linkExistingPatient.identifiers).toContainEqual({
			system: 'MRN',
			value: 'BRH-0001',
			facility: { name: 'Regional Hospital' },
		});
		expect(await prisma.auditLog.count({ where: { patientId: mariaId, action: 'patient.link' } })).toBe(1);

		const byId = await graphql(users.cruz.cookie, GET, { id: mariaId });
		expect(byId.body.data.patient).toEqual({ id: mariaId, givenName: 'Maria' });
	});

	it('refuses to link a patient the details do not match', async () => {
		const unrelated = draft({ givenName: 'Juan', mrn: 'THC-7777', philHealthId: null, patientId: mariaId });
		delete (unrelated as Record<string, unknown>).acknowledgeDuplicates;
		const res = await graphql(users.santos.cookie, LINK, { input: unrelated });
		expect(res.body.errors?.[0].extensions.code).toBe('FORBIDDEN');
		const byId = await graphql(users.santos.cookie, GET, { id: mariaId });
		expect(byId.body.data.patient).toBeNull();
	});
});
