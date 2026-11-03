import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatRepository } from '../../chats/chat.repository.js';
import type { OrganizationRepository } from '../../organizations/organization.repository.js';
import type { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { RegisterPatientInput } from './dto/patient.input.js';
import { DuplicateMatch } from './models/patient.model.js';
import type { PatientMatchRow, PatientRepository } from './patient.repository.js';
import { PatientService } from './patient.service.js';

const FACILITY = { id: 'hc', name: 'Health Center', slug: 'hc' };
const tx = {} as never;

const match = (id: string, givenName = 'Maria'): PatientMatchRow =>
	({
		id,
		givenName,
		familyName: 'Santos',
		birthDate: new Date('1980-05-02T00:00:00Z'),
		identifiers: [{ organization: { name: 'Other Clinic' } }],
	}) as PatientMatchRow;

const input = (overrides: Partial<RegisterPatientInput> = {}): RegisterPatientInput => ({
	facilityId: FACILITY.id,
	givenName: ' Maria ',
	familyName: 'Santos',
	birthDate: '1980-05-02',
	sex: 'female',
	mrn: 'THC-1',
	philHealthId: '12-345678901-2',
	consentGiven: true,
	acknowledgeDuplicates: false,
	...overrides,
});

describe('PatientService', () => {
	let repository: Record<keyof PatientRepository, ReturnType<typeof vi.fn>>;
	let service: PatientService;

	beforeEach(() => {
		repository = {
			getById: vi.fn().mockResolvedValue(null),
			getChart: vi.fn().mockResolvedValue(null),
			search: vi.fn().mockResolvedValue([]),
			visibleIds: vi.fn().mockResolvedValue(new Set()),
			findByIdentifier: vi.fn().mockResolvedValue([]),
			findByNameBirthSex: vi.fn().mockResolvedValue([]),
			create: vi.fn().mockResolvedValue({ id: 'new' }),
			addIdentifiers: vi.fn(),
			setConsentIfMissing: vi.fn(),
			addCareRelationship: vi.fn(),
			updateContact: vi.fn(),
			writeAudit: vi.fn(),
		};
		const db = {
			asSystem: (fn: (t: never) => unknown) => Promise.resolve(fn(tx)),
			asUser: (_userId: string, fn: (t: never) => unknown) => Promise.resolve(fn(tx)),
		} as unknown as ClinicalDbService;
		const organizations = {
			getUserFacilities: vi.fn().mockResolvedValue([FACILITY]),
		} as unknown as OrganizationRepository;
		service = new PatientService(
			db,
			repository as unknown as PatientRepository,
			organizations,
			{} as ChatRepository,
			{} as WiseProposalService,
		);
	});

	it('looks up the MRN at the facility only and the PhilHealth number at every facility', async () => {
		await service.checkDuplicates('u', input());
		expect(repository.findByIdentifier).toHaveBeenCalledWith(tx, { system: 'MRN', value: 'THC-1', orgId: 'hc' });
		expect(repository.findByIdentifier).toHaveBeenCalledWith(tx, {
			system: 'PhilHealth',
			value: '12-345678901-2',
		});
		expect(repository.findByNameBirthSex).toHaveBeenCalledWith(tx, {
			givenName: 'Maria',
			familyName: 'Santos',
			birthDate: new Date('1980-05-02T00:00:00Z'),
			sex: 'female',
		});
	});

	it('masks a duplicate the user cannot see and reports one entry per patient, exact match first', async () => {
		repository.findByIdentifier.mockResolvedValueOnce([match('p1')]);
		repository.findByNameBirthSex.mockResolvedValue([match('p1'), match('p2')]);
		repository.visibleIds.mockResolvedValue(new Set(['p2']));

		expect(await service.checkDuplicates('u', input())).toEqual([
			expect.objectContaining({
				patientId: 'p1',
				match: DuplicateMatch.EXACT_IDENTIFIER,
				visible: false,
				displayName: 'M. S.',
				birthYear: 1980,
				facilityNames: ['Other Clinic'],
			}),
			expect.objectContaining({
				patientId: 'p2',
				match: DuplicateMatch.NAME_BIRTH_SEX,
				displayName: 'Maria Santos',
			}),
		]);
	});

	it('never registers over an identifier match, even when duplicates are acknowledged', async () => {
		repository.findByIdentifier.mockResolvedValueOnce([match('p1')]);
		const result = await service.register('u', input({ acknowledgeDuplicates: true }));
		expect(result.patient).toBeNull();
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('registers over a name match only once acknowledged, and says so in the audit row', async () => {
		repository.findByNameBirthSex.mockResolvedValue([match('p1')]);
		expect((await service.register('u', input())).patient).toBeNull();
		expect(repository.create).not.toHaveBeenCalled();

		await service.register('u', input({ acknowledgeDuplicates: true }));
		expect(repository.create).toHaveBeenCalledWith(tx, expect.objectContaining({ consentAt: expect.any(Date) }));
		expect(repository.addCareRelationship).toHaveBeenCalledWith(tx, {
			patientId: 'new',
			userId: 'u',
			orgId: 'hc',
			reason: 'encounter',
		});
		expect(repository.writeAudit).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ action: 'patient.register', reason: expect.stringMatching(/despite/) }),
		);
	});

	it('requires consent, a facility of the user and valid fields', async () => {
		await expect(service.register('u', input({ consentGiven: false }))).rejects.toThrow(/consent/);
		await expect(service.register('u', input({ facilityId: 'elsewhere' }))).rejects.toThrow(/facility/);
		await expect(service.register('u', input({ birthDate: '1980-13-01' }))).rejects.toThrow(/date/);
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('links only a patient the draft matches', async () => {
		await expect(service.linkExisting('u', { ...input(), patientId: 'p9' })).rejects.toThrow(/does not match/);
		expect(repository.addCareRelationship).not.toHaveBeenCalled();
	});

	it('tells Wise about the patient of a chart chat, with allergies, problems, medicines, vitals, results and the latest encounters (ids for the record tools and explain_result), and audits it', async () => {
		repository.getChart.mockResolvedValue({
			givenName: 'Maria',
			familyName: 'Santos',
			birthDate: new Date('1981-04-12T00:00:00Z'),
			sex: 'female',
			phone: null,
			preferredLanguage: 'ceb',
			consentAt: new Date('2026-10-04T00:00:00Z'),
			identifiers: [{ system: 'MRN', value: 'THC-0001', organization: { name: 'Health Center' } }],
			allergies: [{ substance: 'Penicillin', reaction: 'Hives' }],
			diagnoses: [
				{ icd10Code: 'I10', display: 'Essential (primary) hypertension' },
				{ icd10Code: 'I10', display: 'Essential (primary) hypertension' },
			],
			prescriptions: [{ items: [{ genericName: 'Amlodipine', strength: '5 mg', frequency: 'once a day' }] }],
			vitalSigns: [
				{
					recordedAt: new Date('2026-10-20T01:00:00Z'),
					systolicMmHg: 140,
					diastolicMmHg: 90,
					weightKg: 72,
					bmi: 30,
				},
			],
			results: [
				{
					id: 'r1',
					resultedAt: new Date('2026-10-22T00:00:00Z'),
					display: 'Hemoglobin A1c',
					code: '4548-4',
					value: '7.2',
					unit: '%',
					flag: 'high',
				},
			],
			encounters: [
				{
					id: 'e1',
					startedAt: new Date('2026-10-20T01:00:00Z'),
					reason: 'Fatigue',
					notes: 'BP 140/90.\nOrder HbA1c.',
					history: null,
					physicalExam: null,
					assessment: 'Hypertension',
					plan: 'HbA1c,\nFBS',
					patientInstructions: null,
					followUpOn: new Date('2026-11-20T00:00:00Z'),
				},
			],
		});
		const summary = await service.getChartSummary('u', 'p1', new Date('2026-11-03T00:00:00Z'));
		expect(summary).toBe(
			[
				'- Name: Maria Santos',
				'- Born 1981-04-12 (age 45), sex female',
				'- Preferred language: ceb; mobile: none on file',
				'- Consent: recorded 2026-10-04',
				'- MRN THC-0001 (Health Center)',
				'- Allergies: Penicillin (Hives)',
				'- Problems (ICD-10): Essential (primary) hypertension (I10)',
				'- Prescribed (issued): Amlodipine 5 mg once a day',
				'- Latest vitals (2026-10-20): BP 140/90 mmHg, weight 72 kg, BMI 30',
				'- Latest results (newest first):',
				'  - 2026-10-22 [result r1] Hemoglobin A1c: 7.2 % (high)',
				'- Latest encounters (newest first, up to 1):',
				'  - 2026-10-20 [encounter e1]: Fatigue — Hypertension',
				'    - Plan: HbA1c, FBS',
				'    - Follow-up on: 2026-11-20',
			].join('\n'),
		);
		expect(repository.writeAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'patient.view' }));
	});

	it('says nothing about a patient the user may no longer see', async () => {
		expect(await service.getChartSummary('u', 'gone')).toBeNull();
		expect(repository.writeAudit).not.toHaveBeenCalled();
	});
});
