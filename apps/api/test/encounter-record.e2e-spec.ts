import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createClinicalTestApp, graphql, resetDatabase, signIn, useTestDatabase } from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinicScene,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';

const ENCOUNTER_FIELDS =
	'id encounterNo patientId clinicId type status practitionerId reason history physicalExam assessment plan patientInstructions followUpOn disposition endedAt version clinic { name } practitioner { id displayName }';
const CREATE = `mutation ($input: CreateEncounterInput!) { createEncounter(input: $input) { ${ENCOUNTER_FIELDS} } }`;
const TRANSITION = `mutation ($input: TransitionEncounterInput!) { transitionEncounter(input: $input) { ${ENCOUNTER_FIELDS} } }`;
const RECORD = `query ($id: ID!) {
	encounterRecord(encounterId: $id) {
		canEdit
		encounter { ${ENCOUNTER_FIELDS} }
		vitals { id systolicMmHg diastolicMmHg weightKg heightCm bmi bloodGlucoseMgDl voidedAt voidReason }
		diagnoses { id icd10Code description type isFinal sortOrder voidedAt }
		allergies { allergen }
	}
}`;
const NOTE = `mutation ($input: UpdateEncounterNoteInput!) { updateEncounterNote(input: $input) { ${ENCOUNTER_FIELDS} } }`;
const VITALS = `mutation ($input: RecordVitalsInput!) { recordVitals(input: $input) { id systolicMmHg bmi bloodGlucoseMgDl } }`;
const VOID_VITALS = `mutation ($input: VoidEntryInput!) { voidVitals(input: $input) { id voidedAt voidReason } }`;
const ADD_DIAGNOSIS = `mutation ($input: AddDiagnosisInput!) { addDiagnosis(input: $input) { id icd10Code description type isFinal sortOrder } }`;
const UPDATE_DIAGNOSIS = `mutation ($input: UpdateDiagnosisInput!) { updateDiagnosis(input: $input) { id type isFinal } }`;
const VOID_DIAGNOSIS = `mutation ($input: VoidEntryInput!) { voidDiagnosis(input: $input) { id voidedAt } }`;
const OVERVIEW = `query ($id: ID!) { patientOverview(patientId: $id) { patientId visits { encounter { id encounterNo } diagnoses { icd10Code type } } } }`;
const QUEUE = `query ($input: ClinicEncountersInput!) { clinicEncounters(input: $input) { id status } }`;
const SAVE_PRACTITIONER = `mutation ($input: SaveMyPractitionerInput!) { saveMyPractitioner(input: $input) { id displayName prcLicenseNo ptrNo clinics { clinicName } } }`;

/**
 * Encounters and their record through GraphQL (DESIGN.md §5): a visit opened at one of the user's clinics with its
 * number and status machine, the SOAP note with optimistic locking, vitals and ICD-10 diagnoses (one primary), each
 * change audited; row-level security on every read.
 */
describe('encounters and their record (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	let frontDesk: FixtureUser;
	const cookies: Record<'doctor' | 'otherDoctor' | 'frontDesk', string[]> = {
		doctor: [],
		otherDoctor: [],
		frontDesk: [],
	};
	let visitId = '';

	const call = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		graphql(app, cookie, query, variables);
	const ok = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) => {
		const res = await call(cookie, query, variables);
		expect(res.body.errors).toBeUndefined();
		return res.body.data;
	};
	const errorCode = async (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		(await call(cookie, query, variables)).body.errors?.[0]?.extensions?.errorCode;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp();
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		frontDesk = await createUser(prisma, { firstName: 'Fe', lastName: 'Desk' });
		await grantClinicRoles(prisma, scene.clinic.id, frontDesk.id, ['RECEPTIONIST']);
		cookies.doctor = await signIn(app, scene.doctor);
		cookies.otherDoctor = await signIn(app, scene.otherDoctor);
		cookies.frontDesk = await signIn(app, frontDesk);
	});

	afterAll(async () => {
		await app?.close();
	});

	it('checks a patient in at the front desk: numbered, OPEN, no doctor, audited', async () => {
		const { createEncounter } = await ok(cookies.doctor, CREATE, {
			input: {
				patientId: scene.patient.id,
				clinicId: scene.clinic.id,
				reason: 'Fatigue, BP check',
				status: 'OPEN',
				type: 'FOLLOW_UP',
			},
		});
		expect(createEncounter).toMatchObject({
			encounterNo: expect.stringMatching(new RegExp(`^${scene.clinic.code}-ENC-\\d{4}-000001$`)),
			status: 'OPEN',
			type: 'FOLLOW_UP',
			reason: 'Fatigue, BP check',
			practitioner: { id: scene.doctorPractitioner.id },
			clinic: { name: scene.clinic.name },
		});
		visitId = createEncounter.id;
		const audit = await prisma.auditLog.findFirstOrThrow({
			where: { event: 'encounter.create', entityId: visitId },
		});
		expect(audit).toMatchObject({ action: 'CREATE', patientId: scene.patient.id, clinicId: scene.clinic.id });
	});

	it('lets the front desk see the patient once they have a visit at the clinic, and the queue', async () => {
		const { clinicEncounters } = await ok(cookies.frontDesk, QUEUE, {
			input: { clinicId: scene.clinic.id, statuses: ['OPEN'] },
		});
		expect(clinicEncounters.map((row: { id: string }) => row.id)).toContain(visitId);
	});

	it('opens a visit without a doctor at the front desk, which a doctor takes by starting it', async () => {
		const { createEncounter } = await ok(cookies.frontDesk, CREATE, {
			input: { patientId: scene.patient.id, clinicId: scene.clinic.id, reason: 'Cough' },
		});
		expect(createEncounter).toMatchObject({ status: 'OPEN', practitionerId: null });
		// The colleague has no care relationship yet; starting the visit gives them the patient.
		expect(
			(await call(cookies.otherDoctor, RECORD, { id: createEncounter.id })).body.data.encounterRecord,
		).toBeNull();
		const taken = await call(cookies.frontDesk, TRANSITION, {
			input: { encounterId: createEncounter.id, status: 'IN_PROGRESS' },
		});
		expect(taken.body.data.transitionEncounter).toMatchObject({ status: 'IN_PROGRESS', practitionerId: null });
		const cancelled = await ok(cookies.frontDesk, TRANSITION, {
			input: { encounterId: createEncounter.id, status: 'CANCELLED', reason: 'Left before being seen' },
		});
		expect(cancelled.transitionEncounter.endedAt).not.toBeNull();
		expect(
			await errorCode(cookies.doctor, VITALS, {
				input: { encounterId: createEncounter.id, systolicMmHg: 120, diastolicMmHg: 80 },
			}),
		).toBe('ENCOUNTER_CANCELLED');
		expect(
			await errorCode(cookies.frontDesk, TRANSITION, {
				input: { encounterId: createEncounter.id, status: 'OPEN' },
			}),
		).toBe('INVALID_STATUS_TRANSITION');
	});

	it('refuses a clinic the user does not work at and a status a visit cannot start with', async () => {
		expect(
			await errorCode(cookies.doctor, CREATE, {
				input: { patientId: scene.patient.id, clinicId: '0195f000-0000-7000-8000-000000000999', reason: 'x' },
			}),
		).toBe('CLINIC_NOT_AVAILABLE');
		const completed = await call(cookies.doctor, CREATE, {
			input: { patientId: scene.patient.id, clinicId: scene.clinic.id, reason: 'x', status: 'COMPLETED' },
		});
		expect(completed.body.errors?.[0]?.extensions?.code).toBe('BAD_REQUEST');
	});

	it('reads the record, audits the view, and hides it from a doctor without a care relationship', async () => {
		const { encounterRecord } = await ok(cookies.doctor, RECORD, { id: visitId });
		expect(encounterRecord).toMatchObject({ canEdit: true, vitals: [], diagnoses: [], allergies: [] });
		expect(await prisma.auditLog.count({ where: { event: 'encounter.view', entityId: visitId } })).toBe(1);
		expect((await call(cookies.otherDoctor, RECORD, { id: visitId })).body.data.encounterRecord).toBeNull();
	});

	it('moves the visit along its status machine and refuses a stale or invalid move', async () => {
		const { transitionEncounter } = await ok(cookies.doctor, TRANSITION, {
			input: { encounterId: visitId, status: 'IN_PROGRESS' },
		});
		expect(transitionEncounter.status).toBe('IN_PROGRESS');
		expect(
			await errorCode(cookies.doctor, TRANSITION, {
				input: {
					encounterId: visitId,
					status: 'FOR_BILLING',
					expectedVersion: transitionEncounter.version - 1,
				},
			}),
		).toBe('STALE_VERSION');
		expect(await errorCode(cookies.doctor, TRANSITION, { input: { encounterId: visitId, status: 'OPEN' } })).toBe(
			'INVALID_STATUS_TRANSITION',
		);
		const audit = await prisma.auditLog.findFirstOrThrow({
			where: { event: 'encounter.in_progress', entityId: visitId },
		});
		expect(audit.changes).toEqual({ before: { status: 'OPEN' }, after: { status: 'IN_PROGRESS' } });
	});

	it('updates the SOAP note against its version, the exam stored as a JSON string', async () => {
		const { encounterRecord } = await ok(cookies.doctor, RECORD, { id: visitId });
		const note = {
			encounterId: visitId,
			reason: 'Fatigue for 2 weeks',
			history: 'Tired in the afternoons.',
			physicalExam: 'BP 140/90, no edema.',
			assessment: 'Hypertension, stage 1',
			plan: 'Amlodipine 5 mg once a day',
			patientInstructions: 'Less salt.',
			followUpOn: '2026-12-01',
			disposition: 'FOR_FOLLOW_UP',
			expectedVersion: encounterRecord.encounter.version,
		};
		const { updateEncounterNote } = await ok(cookies.doctor, NOTE, { input: note });
		expect(updateEncounterNote).toMatchObject({
			reason: 'Fatigue for 2 weeks',
			physicalExam: 'BP 140/90, no edema.',
			followUpOn: '2026-12-01',
			disposition: 'FOR_FOLLOW_UP',
			version: note.expectedVersion + 1,
		});
		const row = await prisma.encounter.findUniqueOrThrow({ where: { id: visitId } });
		expect(row.physicalExam).toBe('BP 140/90, no edema.');
		expect(row.chiefComplaint).toBe('Fatigue for 2 weeks');

		expect(await errorCode(cookies.doctor, NOTE, { input: note })).toBe('STALE_VERSION');
		const audit = await prisma.auditLog.findFirstOrThrow({ where: { event: 'encounter.update_note' } });
		expect(audit.changes).toMatchObject({ after: { assessment: 'Hypertension, stage 1' } });
	});

	it('keeps the follow-up date and disposition when a save leaves them out, and clears them when sent null', async () => {
		// As Wise's `propose_encounter_note` card saves: its fields only, no disposition.
		const { encounterRecord } = await ok(cookies.doctor, RECORD, { id: visitId });
		const { updateEncounterNote: kept } = await ok(cookies.doctor, NOTE, {
			input: {
				encounterId: visitId,
				reason: 'Fatigue for 2 weeks',
				plan: 'Amlodipine 10 mg once a day',
				expectedVersion: encounterRecord.encounter.version,
			},
		});
		expect(kept).toMatchObject({
			plan: 'Amlodipine 10 mg once a day',
			followUpOn: '2026-12-01',
			disposition: 'FOR_FOLLOW_UP',
		});

		const { updateEncounterNote: cleared } = await ok(cookies.doctor, NOTE, {
			input: { encounterId: visitId, reason: 'Fatigue for 2 weeks', followUpOn: null, disposition: null },
		});
		expect(cleared).toMatchObject({ followUpOn: null, disposition: null });

		// Put them back for the tests after this one.
		await ok(cookies.doctor, NOTE, {
			input: {
				encounterId: visitId,
				reason: 'Fatigue for 2 weeks',
				followUpOn: '2026-12-01',
				disposition: 'FOR_FOLLOW_UP',
			},
		});
	});

	it('records vitals with the BMI computed, rejects implausible values, and voids an entry', async () => {
		const { recordVitals } = await ok(cookies.doctor, VITALS, {
			input: {
				encounterId: visitId,
				systolicMmHg: 140,
				diastolicMmHg: 90,
				weightKg: 72,
				heightCm: 155,
				bloodGlucoseMgDl: 131,
			},
		});
		expect(recordVitals).toMatchObject({ systolicMmHg: 140, bmi: 30, bloodGlucoseMgDl: 131 });
		expect(await errorCode(cookies.doctor, VITALS, { input: { encounterId: visitId, temperatureC: 52 } })).toBe(
			'INVALID_INPUT',
		);
		const { voidVitals } = await ok(cookies.doctor, VOID_VITALS, {
			input: { id: recordVitals.id, reason: 'Wrong patient' },
		});
		expect(voidVitals.voidReason).toBe('Wrong patient');
		expect(
			await errorCode(cookies.doctor, VOID_VITALS, { input: { id: recordVitals.id, reason: 'Again please' } }),
		).toBe('ALREADY_VOIDED');
		expect(
			await errorCode(cookies.otherDoctor, VOID_VITALS, { input: { id: recordVitals.id, reason: 'Not mine' } }),
		).toBe('ENTITY_NOT_FOUND');
		const events = await prisma.auditLog.findMany({
			where: { entityType: 'VitalSigns' },
			orderBy: { createdAt: 'asc' },
			select: { action: true, event: true },
		});
		expect(events).toEqual([
			{ action: 'CREATE', event: 'vitals.record' },
			{ action: 'VOID', event: 'vitals.void' },
		]);
	});

	it('codes diagnoses in ICD-10 against icd10_codes, with one primary', async () => {
		const first = (
			await ok(cookies.doctor, ADD_DIAGNOSIS, {
				input: { encounterId: visitId, icd10Code: 'i10', description: 'Essential (primary) hypertension' },
			})
		).addDiagnosis;
		expect(first).toMatchObject({ icd10Code: 'I10', type: 'PRIMARY', isFinal: true, sortOrder: 0 });
		const second = (
			await ok(cookies.doctor, ADD_DIAGNOSIS, {
				input: { encounterId: visitId, icd10Code: 'E11.9', description: 'Type 2 diabetes', isFinal: false },
			})
		).addDiagnosis;
		expect(second).toMatchObject({ type: 'SECONDARY', isFinal: false, sortOrder: 1 });
		expect(
			await errorCode(cookies.doctor, ADD_DIAGNOSIS, {
				input: { encounterId: visitId, icd10Code: 'Z99.99', description: 'x' },
			}),
		).toBe('UNKNOWN_ICD10_CODE');

		await ok(cookies.doctor, UPDATE_DIAGNOSIS, { input: { id: second.id, type: 'PRIMARY', isFinal: true } });
		const { encounterRecord } = await ok(cookies.doctor, RECORD, { id: visitId });
		expect(
			encounterRecord.diagnoses.map((row: { icd10Code: string; type: string }) => [row.icd10Code, row.type]),
		).toEqual([
			['E11.9', 'PRIMARY'],
			['I10', 'SECONDARY'],
		]);

		await ok(cookies.doctor, VOID_DIAGNOSIS, { input: { id: second.id, reason: 'Not diabetic: FBS normal' } });
		const third = (
			await ok(cookies.doctor, ADD_DIAGNOSIS, {
				input: { encounterId: visitId, icd10Code: 'R53', description: 'Malaise and fatigue', type: 'PRIMARY' },
			})
		).addDiagnosis;
		expect(third.type).toBe('PRIMARY');
	});

	it("gives the chart an overview of the patient's visits, and nothing for a patient not in your care", async () => {
		const { patientOverview } = await ok(cookies.doctor, OVERVIEW, { id: scene.patient.id });
		expect(patientOverview.visits.map((visit: { encounter: { id: string } }) => visit.encounter.id)).toContain(
			visitId,
		);
		const visit = patientOverview.visits.find((row: { encounter: { id: string } }) => row.encounter.id === visitId);
		expect(visit.diagnoses.map((row: { icd10Code: string }) => row.icd10Code)).toEqual(['R53', 'I10']);
		const hidden = await ok(cookies.otherDoctor, OVERVIEW, { id: scene.patient.id });
		expect(hidden.patientOverview.visits).toEqual([]);
	});

	it('keeps a practitioner profile per PRC license number', async () => {
		const { saveMyPractitioner } = await ok(cookies.doctor, SAVE_PRACTITIONER, {
			input: { prcLicenseNo: '0123456', title: 'Dr.', postNominals: 'MD', ptrNo: 'PTR-2026-77' },
		});
		expect(saveMyPractitioner).toMatchObject({
			id: scene.doctorPractitioner.id,
			prcLicenseNo: '0123456',
			ptrNo: 'PTR-2026-77',
		});
		expect(saveMyPractitioner.displayName).toMatch(/^Dr\. .+, MD$/);
		expect(await errorCode(cookies.otherDoctor, SAVE_PRACTITIONER, { input: { prcLicenseNo: '0123456' } })).toBe(
			'PRC_LICENSE_TAKEN',
		);
		const created = await ok(cookies.otherDoctor, SAVE_PRACTITIONER, { input: { prcLicenseNo: '0654321' } });
		expect(created.saveMyPractitioner.clinics).toEqual([{ clinicName: scene.clinic.name }]);
	});
});
