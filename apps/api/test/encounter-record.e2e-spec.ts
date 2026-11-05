import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const RECORD = `query ($id: ID!) {
	encounterRecord(encounterId: $id) {
		canEdit
		encounter { id reason history assessment plan followUpOn }
		vitals { id systolicMmHg diastolicMmHg weightKg heightCm bmi voidedAt voidReason }
		diagnoses { id icd10Code display isPrimary certainty voidedAt }
		allergies { substance }
		orders { code display status targetFacility { name } results { value } }
		prescriptions { id status rxNumber items { genericName quantity } }
		medicalCertificates { id status certificateNumber }
		bills { id status total }
	}
}`;

/**
 * The encounter record through GraphQL (DESIGN.md §7): the note, vitals (BMI computed), ICD-10 diagnoses, allergies,
 * orders, prescriptions and medical certificates; row-level security on every read, the facility check on every
 * write, audit rows, and locked issued documents.
 */
describe('encounter record (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let encounterId = '';
	let patientId = '';
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		lim: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
	};
	const facilities = { healthCenter: '', otherClinic: '', hospital: '', lab: '' };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	const ok = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(cookie, query, variables);
		expect(res.body.errors).toBeUndefined();
		return res.body.data;
	};

	const errorOf = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await graphql(cookie, query, variables);
		expect(res.body.errors).toBeDefined();
		return res.body.errors[0].message as string;
	};

	const record = async (cookie = users.reyes.cookie) =>
		(await ok(cookie, RECORD, { id: encounterId })).encounterRecord;

	const audits = (action: string) => prisma.auditLog.count({ where: { action, patientId } });

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);

		const password = 'Sup3r-secret!';
		for (const key of ['reyes', 'lim', 'cruz'] as const) {
			const user = await createTestUser(app, { name: `Dr. ${key}`, email: `${key}@example.com`, password });
			users[key] = { cookie: user.cookie, id: user.userId };
		}
		const workspace = await prisma.organization.findFirstOrThrow();
		await prisma.clinic.create({ data: { name: 'Loopwise', type: 'local', path: '/tmp/x', orgId: workspace.id } });
		const org = (name: string, slug: string, type: 'clinic' | 'hospital' | 'lab') =>
			prisma.organization.create({ data: { name, slug, type, address: `${name} Street, Tagbilaran` } });
		facilities.healthCenter = (await org('Health Center', 'hc', 'clinic')).id;
		facilities.otherClinic = (await org('Other Clinic', 'oc', 'clinic')).id;
		facilities.hospital = (await org('Regional Hospital', 'rh', 'hospital')).id;
		facilities.lab = (await org('Bohol Lab', 'lab', 'lab')).id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: facilities.healthCenter, userId: users.reyes.id, role: 'user' },
				{ orgId: facilities.otherClinic, userId: users.lim.id, role: 'user' },
				{ orgId: facilities.hospital, userId: users.cruz.id, role: 'user' },
			],
		});

		// Maria is in the care of Dr. Reyes (health center) and, through a referral, Dr. Cruz (hospital).
		const maria = await prisma.patient.create({
			data: {
				givenName: 'Maria',
				familyName: 'Santos',
				birthDate: new Date('1981-04-12'),
				sex: 'female',
				careRelationships: {
					create: [
						{ userId: users.reyes.id, orgId: facilities.healthCenter, reason: 'encounter' },
						{ userId: users.cruz.id, orgId: facilities.hospital, reason: 'referral' },
					],
				},
			},
		});
		patientId = maria.id;
		const created = await ok(
			users.reyes.cookie,
			'mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { id } }',
			{ input: { patientId, facilityId: facilities.healthCenter, reason: 'Fatigue' } },
		);
		encounterId = created.createEncounter.id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('reads the empty record, audits the view, and hides it from a doctor without a care relationship', async () => {
		const empty = await record();
		expect(empty).toMatchObject({ canEdit: true, vitals: [], diagnoses: [], prescriptions: [] });
		expect(await audits('encounter.view')).toBe(1);
		expect((await ok(users.lim.cookie, RECORD, { id: encounterId })).encounterRecord).toBeNull();
		// Dr. Cruz sees the patient (referral) but works elsewhere, so reads but can't add to the visit.
		expect((await record(users.cruz.cookie)).canEdit).toBe(false);
	});

	it('updates the SOAP note and plan', async () => {
		const { updateEncounterNote } = await ok(
			users.reyes.cookie,
			`mutation ($input: UpdateEncounterNoteInput!) { updateEncounterNote(input: $input) { reason assessment followUpOn } }`,
			{
				input: {
					encounterId,
					reason: 'Fatigue, frequent urination',
					history: '2 weeks of fatigue',
					assessment: 'Hypertension; rule out diabetes',
					plan: 'HbA1c, FBS; amlodipine',
					followUpOn: '2026-11-20',
				},
			},
		);
		expect(updateEncounterNote).toEqual({
			reason: 'Fatigue, frequent urination',
			assessment: 'Hypertension; rule out diabetes',
			followUpOn: '2026-11-20',
		});
		expect(await audits('encounter.update_note')).toBe(1);
	});

	it('records vitals with the BMI computed, rejects implausible values, and voids an entry', async () => {
		const RECORD_VITALS = `mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id bmi } }`;
		const { recordVitals } = await ok(users.reyes.cookie, RECORD_VITALS, {
			input: { encounterId, systolicMmHg: 140, diastolicMmHg: 90, weightKg: 72, heightCm: 155 },
		});
		expect(recordVitals.bmi).toBe(30);
		expect(
			await errorOf(users.reyes.cookie, RECORD_VITALS, {
				input: { encounterId, systolicMmHg: 90, diastolicMmHg: 120 },
			}),
		).toMatch(/below systolic/);
		expect(await errorOf(users.cruz.cookie, RECORD_VITALS, { input: { encounterId, heartRateBpm: 80 } })).toMatch(
			/Only staff at the facility/,
		);
		expect(await errorOf(users.lim.cookie, RECORD_VITALS, { input: { encounterId, heartRateBpm: 80 } })).toMatch(
			/not found/,
		);

		const wrong = await ok(users.reyes.cookie, RECORD_VITALS, { input: { encounterId, heartRateBpm: 200 } });
		await ok(users.reyes.cookie, `mutation ($input: VoidEntryInput!) { voidVitals(input: $input) { voidedAt } }`, {
			input: { id: wrong.recordVitals.id, reason: 'Wrong patient' },
		});
		const { vitals } = await record();
		expect(vitals).toHaveLength(2);
		expect(vitals.find((row: { voidReason: string | null }) => row.voidReason === 'Wrong patient')).toBeTruthy();
		expect(await audits('vitals.record')).toBe(2);
		expect(await audits('vitals.void')).toBe(1);
	});

	it('codes diagnoses in ICD-10 with one primary', async () => {
		const ADD = `mutation ($input: AddDiagnosisInput!) { addDiagnosis(input: $input) { id icd10Code isPrimary } }`;
		const first = (
			await ok(users.reyes.cookie, ADD, {
				input: { encounterId, icd10Code: 'i10', display: 'Essential (primary) hypertension' },
			})
		).addDiagnosis;
		expect(first).toMatchObject({ icd10Code: 'I10', isPrimary: true });
		const second = (
			await ok(users.reyes.cookie, ADD, {
				input: { encounterId, icd10Code: 'R53', display: 'Malaise and fatigue' },
			})
		).addDiagnosis;
		expect(second.isPrimary).toBe(false);
		expect(
			await errorOf(users.reyes.cookie, ADD, { input: { encounterId, icd10Code: 'flu', display: 'Flu' } }),
		).toMatch(/ICD-10/);

		await ok(
			users.reyes.cookie,
			`mutation ($input: UpdateDiagnosisInput!) { updateDiagnosis(input: $input) { isPrimary } }`,
			{ input: { id: second.id, isPrimary: true } },
		);
		const { diagnoses } = await record();
		expect(
			diagnoses.map((row: { icd10Code: string; isPrimary: boolean }) => [row.icd10Code, row.isPrimary]),
		).toEqual([
			['R53', true],
			['I10', false],
		]);
		const { searchIcd10 } = await ok(users.reyes.cookie, '{ searchIcd10(query: "hypertension") { code } }');
		expect(searchIcd10.map((row: { code: string }) => row.code)).toContain('I10');
	});

	it('orders a test from the encounter and sends it to the lab', async () => {
		const { createEncounterOrder } = await ok(
			users.reyes.cookie,
			`mutation ($input: CreateEncounterOrderInput!) { createEncounterOrder(input: $input) { status display targetFacility { name } } }`,
			{ input: { encounterId, code: '4548-4', targetOrgId: facilities.lab } },
		);
		expect(createEncounterOrder).toEqual({
			status: 'sent',
			display: 'Hemoglobin A1c',
			targetFacility: { name: 'Bohol Lab' },
		});
		expect((await record()).orders).toHaveLength(1);
		expect(await audits('order.create')).toBe(1);
	});

	describe('prescriptions', () => {
		const SAVE = `mutation ($input: SavePrescriptionInput!) { savePrescription(input: $input) { id status items { genericName } } }`;
		const ISSUE = `mutation ($id: ID!, $override: Boolean) { issuePrescription(id: $id, overrideAllergyWarning: $override) { status rxNumber } }`;
		const amlodipine = {
			genericName: 'Amlodipine',
			strength: '5 mg',
			dose: '1 tablet',
			frequency: 'once a day',
			quantity: 30,
		};
		let rxId = '';

		it('saves and replaces a draft', async () => {
			rxId = (await ok(users.reyes.cookie, SAVE, { input: { encounterId, items: [amlodipine] } }))
				.savePrescription.id;
			const replaced = await ok(users.reyes.cookie, SAVE, {
				input: {
					id: rxId,
					encounterId,
					items: [amlodipine, { ...amlodipine, genericName: 'Losartan', strength: '50 mg' }],
				},
			});
			expect(replaced.savePrescription.items.map((item: { genericName: string }) => item.genericName)).toEqual([
				'Amlodipine',
				'Losartan',
			]);
			expect(await errorOf(users.reyes.cookie, SAVE, { input: { encounterId, items: [] } })).toMatch(
				/at least one/,
			);
		});

		it('needs a PRC license to issue, then locks the prescription', async () => {
			expect(await errorOf(users.reyes.cookie, ISSUE, { id: rxId })).toMatch(/PRC license/);
			await ok(
				users.reyes.cookie,
				'mutation { updateMyClinicianProfile(input: { credentials: "MD", prcLicenseNumber: "0000001", ptrNumber: "PTR-1" }) { prcLicenseNumber } }',
			);
			const { issuePrescription } = await ok(users.reyes.cookie, ISSUE, { id: rxId });
			expect(issuePrescription.status).toBe('issued');
			expect(issuePrescription.rxNumber).toMatch(/^RX-\d{8}-[0-9A-F]{6}$/);
			expect(
				await errorOf(users.reyes.cookie, SAVE, { input: { id: rxId, encounterId, items: [amlodipine] } }),
			).toMatch(/issued/);
			expect(await audits('prescription.issue')).toBe(1);

			const { prescription } = await ok(
				users.reyes.cookie,
				'query ($id: ID!) { prescription(id: $id) { signatory { name licenseNumber ptrNumber facilityName facilityAddress } } }',
				{ id: rxId },
			);
			expect(prescription.signatory).toEqual({
				name: 'Dr. reyes, MD',
				licenseNumber: '0000001',
				ptrNumber: 'PTR-1',
				facilityName: 'Health Center',
				facilityAddress: 'Health Center Street, Tagbilaran',
			});
			expect(await audits('prescription.view')).toBe(1);
		});

		it('warns about an allergy before issuing, unless overridden', async () => {
			await ok(
				users.reyes.cookie,
				'mutation ($input: AddAllergyInput!) { addAllergy(input: $input) { substance } }',
				{
					input: {
						patientId,
						facilityId: facilities.healthCenter,
						substance: 'Penicillin',
						reaction: 'Rash',
					},
				},
			);
			const allergiesQuery = 'query ($id: ID!) { patientAllergies(patientId: $id) { substance reaction } }';
			expect((await ok(users.reyes.cookie, allergiesQuery, { id: patientId })).patientAllergies).toEqual([
				{ substance: 'Penicillin', reaction: 'Rash' },
			]);
			expect((await ok(users.lim.cookie, allergiesQuery, { id: patientId })).patientAllergies).toEqual([]);
			const draft = await ok(users.reyes.cookie, SAVE, {
				input: { encounterId, items: [{ ...amlodipine, genericName: 'Amoxicillin', strength: '500 mg' }] },
			});
			const id = draft.savePrescription.id;
			expect(await errorOf(users.reyes.cookie, ISSUE, { id })).toMatch(
				/Allergy warning: Amoxicillin \(allergy: Penicillin\)/,
			);
			expect((await ok(users.reyes.cookie, ISSUE, { id, override: true })).issuePrescription.status).toBe(
				'issued',
			);
			const issued = await prisma.auditLog.findFirstOrThrow({
				where: { action: 'prescription.issue', resourceId: id },
			});
			expect(issued.reason).toMatch(/overridden/);
		});

		it('voids an issued prescription with a reason', async () => {
			const VOID = 'mutation ($input: VoidEntryInput!) { voidPrescription(input: $input) { status } }';
			expect(
				(await ok(users.reyes.cookie, VOID, { input: { id: rxId, reason: 'Dose changed' } })).voidPrescription
					.status,
			).toBe('voided');
			expect(await errorOf(users.reyes.cookie, VOID, { input: { id: rxId, reason: 'Again' } })).toMatch(
				/already voided/,
			);
		});
	});

	it('issues a medical certificate with rest days, locked and audited', async () => {
		const { saveMedicalCertificate } = await ok(
			users.reyes.cookie,
			'mutation ($input: SaveMedicalCertificateInput!) { saveMedicalCertificate(input: $input) { id status } }',
			{
				input: {
					encounterId,
					examinedOn: '2026-11-03',
					diagnosisText: 'Essential hypertension',
					fitness: 'unfit',
					restFrom: '2026-11-03',
					restDays: 2,
				},
			},
		);
		const { issueMedicalCertificate } = await ok(
			users.reyes.cookie,
			'mutation ($id: ID!) { issueMedicalCertificate(id: $id) { status certificateNumber } }',
			{ id: saveMedicalCertificate.id },
		);
		expect(issueMedicalCertificate.certificateNumber).toMatch(/^MC-/);
		expect(await audits('medical_certificate.issue')).toBe(1);
		await expect(
			prisma.medicalCertificate.update({ where: { id: saveMedicalCertificate.id }, data: { restDays: 5 } }),
		).rejects.toThrow(/can only be voided/);
		expect((await record()).medicalCertificates).toHaveLength(1);
	});
	describe('billing', () => {
		const SAVE = `mutation ($input: SaveEncounterBillInput!) {
			saveEncounterBill(input: $input) { id status subtotal discountAmount philhealthCoverage total charges { amount } }
		}`;
		const consultation = { kind: 'consultation', description: 'Consultation', quantity: 1, unitPrice: 300 };
		const hba1c = {
			kind: 'laboratory',
			description: 'Hemoglobin A1c',
			code: '4548-4',
			quantity: 1,
			unitPrice: 350,
		};
		let billId = '';

		it('computes the totals itself, with the senior discount and PhilHealth', async () => {
			const { saveEncounterBill } = await ok(users.reyes.cookie, SAVE, {
				input: {
					encounterId,
					charges: [consultation, hba1c],
					discountKind: 'senior_citizen',
					philhealthCoverage: 100,
				},
			});
			expect(saveEncounterBill).toMatchObject({
				status: 'draft',
				subtotal: 650,
				discountAmount: 130,
				philhealthCoverage: 100,
				total: 420,
				charges: [{ amount: 300 }, { amount: 350 }],
			});
			billId = saveEncounterBill.id;
			// Saving again replaces the draft: still one bill.
			const again = await ok(users.reyes.cookie, SAVE, { input: { encounterId, charges: [consultation] } });
			expect(again.saveEncounterBill).toMatchObject({ id: billId, total: 300 });
			expect(await errorOf(users.cruz.cookie, SAVE, { input: { encounterId, charges: [consultation] } })).toMatch(
				/Only staff at the facility/,
			);
		});

		it('finalizes (locked), takes payment with an OR number, and is replaced once voided', async () => {
			await ok(users.reyes.cookie, 'mutation ($id: ID!) { finalizeEncounterBill(id: $id) { status } }', {
				id: billId,
			});
			expect(await errorOf(users.reyes.cookie, SAVE, { input: { encounterId, charges: [hba1c] } })).toMatch(
				/finalized; void it/,
			);
			const PAY =
				'mutation ($input: MarkBillPaidInput!) { markEncounterBillPaid(input: $input) { status orNumber } }';
			expect(
				(await ok(users.reyes.cookie, PAY, { input: { id: billId, orNumber: 'OR-0001' } }))
					.markEncounterBillPaid,
			).toEqual({
				status: 'paid',
				orNumber: 'OR-0001',
			});
			await ok(
				users.reyes.cookie,
				'mutation ($input: VoidEntryInput!) { voidEncounterBill(input: $input) { status } }',
				{
					input: { id: billId, reason: 'Wrong charges' },
				},
			);
			const fresh = await ok(users.reyes.cookie, SAVE, { input: { encounterId, charges: [hba1c] } });
			expect(fresh.saveEncounterBill.id).not.toBe(billId);
			for (const action of ['bill.save', 'bill.finalize', 'bill.pay', 'bill.void']) {
				expect(await audits(action)).toBeGreaterThan(0);
			}
		});
	});

	it("gives the chart an overview of the patient's visits, and nothing for a patient not in your care", async () => {
		const OVERVIEW = `query ($id: ID!) {
			patientOverview(patientId: $id) {
				visits { encounter { id } diagnoses { icd10Code } prescriptions { status } orders { code } billStatus }
			}
		}`;
		const { patientOverview } = await ok(users.reyes.cookie, OVERVIEW, { id: patientId });
		expect(patientOverview.visits).toHaveLength(1);
		const [visit] = patientOverview.visits;
		expect(visit.encounter.id).toBe(encounterId);
		expect(visit.diagnoses.length).toBeGreaterThan(0);
		expect(visit.billStatus).toBe('draft');
		expect(visit.prescriptions.every((rx: { status: string }) => rx.status !== 'voided')).toBe(true);
		expect(await audits('patient.overview')).toBe(1);

		const hidden = (await ok(users.lim.cookie, OVERVIEW, { id: patientId })).patientOverview;
		expect(hidden).toEqual({ visits: [] });
	});
});
