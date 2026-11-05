import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { DocumentSequenceService } from '../clinics/document-sequences/document-sequence.service.js';
import type { ReferenceService } from '../reference/reference.service.js';
import type { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { CareClinicService } from './care-clinic.service.js';
import type { RegisterPatientInput } from './dto/patient.input.js';
import type { PatientMatchRow, PatientRepository } from './patient.repository.js';
import { PatientRegistrationService } from './patient-registration.service.js';
import { DuplicateMatch } from './patients.enums.js';
import { ClinicNotAvailableError, ConsentRequiredError, PatientDoesNotMatchError } from './patients.errors.js';

const CLINIC = {
	id: '0195f000-0000-7000-8000-000000000001',
	name: 'Health Center',
	code: 'TAG',
	organizationId: '0195f000-0000-7000-8000-0000000000aa',
	cityMunicipalityCode: '0701242000',
};
const tx = {} as never;

const NEW_PATIENT = {
	id: 'new',
	organizationId: CLINIC.organizationId,
	patientNo: 'TAG-PT-2026-000001',
	firstName: 'Maria',
	lastName: 'Santos',
	birthDate: new Date('1980-05-02T00:00:00Z'),
	identifications: [],
	addresses: [],
	consents: [],
};

const match = (id: string, firstName = 'Maria'): PatientMatchRow => ({
	id,
	firstName,
	lastName: 'Santos',
	birthDate: new Date('1980-05-02T00:00:00Z'),
});

const input = (overrides: Partial<RegisterPatientInput> = {}): RegisterPatientInput => ({
	clinicId: CLINIC.id,
	givenName: ' Maria ',
	familyName: 'Santos',
	birthDate: '1980-05-02',
	sex: 'FEMALE',
	philHealthId: '12-345678901-2',
	consentGiven: true,
	acknowledgeDuplicates: false,
	...overrides,
});

describe('PatientRegistrationService', () => {
	let repository: Record<string, ReturnType<typeof vi.fn>>;
	let audit: { created: ReturnType<typeof vi.fn>; updated: ReturnType<typeof vi.fn> };
	let sequences: { next: ReturnType<typeof vi.fn> };
	let clinics: { require: ReturnType<typeof vi.fn> };
	let service: PatientRegistrationService;

	beforeEach(() => {
		repository = {
			getById: vi.fn().mockResolvedValue(null),
			visibleIds: vi.fn().mockResolvedValue(new Set()),
			findByPatientNo: vi.fn().mockResolvedValue([]),
			findByIdentification: vi.fn().mockResolvedValue([]),
			findByNameBirthSex: vi.fn().mockResolvedValue([]),
			create: vi.fn().mockResolvedValue(NEW_PATIENT),
			addIdentification: vi.fn(),
			addConsentIfMissing: vi.fn(),
			addCareRelationship: vi.fn(),
		};
		audit = { created: vi.fn(), updated: vi.fn() };
		sequences = { next: vi.fn().mockResolvedValue('TAG-PT-2026-000001') };
		clinics = { require: vi.fn().mockResolvedValue(CLINIC) };
		const db = {
			asSystem: (fn: (t: never) => unknown) => Promise.resolve(fn(tx)),
			asUser: (_userId: string, fn: (t: never) => unknown) => Promise.resolve(fn(tx)),
		} as unknown as ClinicalDbService;
		service = new PatientRegistrationService(
			db,
			repository as unknown as PatientRepository,
			clinics as unknown as CareClinicService,
			sequences as unknown as DocumentSequenceService,
			{} as ReferenceService,
			audit as unknown as AuditService,
			{} as WiseProposalService,
		);
	});

	it('looks up the patient number and PhilHealth number in the clinic’s organization, then the name', async () => {
		await service.checkDuplicates('u', input({ patientNo: 'TAG-PT-2026-000009' }));
		expect(repository.findByPatientNo).toHaveBeenCalledWith(tx, CLINIC.organizationId, 'TAG-PT-2026-000009');
		expect(repository.findByIdentification).toHaveBeenCalledWith(
			tx,
			CLINIC.organizationId,
			'PHILHEALTH_ID',
			'12-345678901-2',
		);
		expect(repository.findByNameBirthSex).toHaveBeenCalledWith(tx, CLINIC.organizationId, {
			firstName: 'Maria',
			lastName: 'Santos',
			birthDate: new Date('1980-05-02T00:00:00Z'),
			sex: 'FEMALE',
		});
	});

	it('masks a duplicate the user cannot see and reports one entry per patient, exact match first', async () => {
		repository.findByIdentification.mockResolvedValueOnce([match('p1')]);
		repository.findByNameBirthSex.mockResolvedValue([match('p1'), match('p2')]);
		repository.visibleIds.mockResolvedValue(new Set(['p2']));

		expect(await service.checkDuplicates('u', input())).toEqual([
			{
				patientId: 'p1',
				match: DuplicateMatch.EXACT_IDENTIFIER,
				visible: false,
				matchedOn: 'PhilHealth 12-345678901-2',
				displayName: 'M. S.',
				birthYear: 1980,
			},
			{
				patientId: 'p2',
				match: DuplicateMatch.NAME_BIRTH_SEX,
				visible: true,
				matchedOn: 'name, birth date and sex',
				displayName: 'Maria Santos',
				birthYear: 1980,
			},
		]);
	});

	it('never registers over an identifier match, even when duplicates are acknowledged', async () => {
		repository.findByIdentification.mockResolvedValue([match('p1')]);
		const outcome = await service.register('u', input({ acknowledgeDuplicates: true }));
		expect(outcome.patient).toBeNull();
		expect(outcome.duplicates).toHaveLength(1);
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('numbers the patient from the clinic’s sequence, records consent and care, and audits', async () => {
		repository.getById.mockResolvedValue(NEW_PATIENT);
		await service.register('u', input({ phone: '0917 123 4567' }));
		expect(sequences.next).toHaveBeenCalledWith(tx, CLINIC, 'PATIENT');
		expect(repository.create).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				organizationId: CLINIC.organizationId,
				patientNo: 'TAG-PT-2026-000001',
				firstName: 'Maria',
				mobileNo: '+639171234567',
				philHealthId: '12-345678901-2',
				consentWitnessedById: 'u',
			}),
		);
		expect(repository.addCareRelationship).toHaveBeenCalledWith(tx, {
			patientId: 'new',
			userId: 'u',
			organizationId: CLINIC.organizationId,
			reason: 'ENCOUNTER',
		});
		expect(audit.created).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				event: 'patient.register',
				entityType: 'Patient',
				entityId: 'new',
				reason: null,
			}),
		);
	});

	it('keeps a chart number the patient brings, and registers over a name match only once acknowledged', async () => {
		repository.findByNameBirthSex.mockResolvedValue([match('p2')]);
		expect((await service.register('u', input({ patientNo: 'OLD-42' }))).patient).toBeNull();

		await service.register('u', input({ patientNo: 'OLD-42', acknowledgeDuplicates: true }));
		expect(sequences.next).not.toHaveBeenCalled();
		expect(repository.create).toHaveBeenCalledWith(tx, expect.objectContaining({ patientNo: 'OLD-42' }));
		expect(audit.created).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ reason: 'registered despite a name, birth date and sex match' }),
		);
	});

	it('requires consent and a clinic of the user', async () => {
		await expect(service.register('u', input({ consentGiven: false }))).rejects.toThrow(ConsentRequiredError);
		clinics.require.mockRejectedValue(new ClinicNotAvailableError('register patients'));
		await expect(service.register('u', input())).rejects.toThrow(ClinicNotAvailableError);
	});

	it('links only a patient the draft matches', async () => {
		await expect(service.linkExisting('u', { ...input(), patientId: 'p9' })).rejects.toThrow(
			PatientDoesNotMatchError,
		);
	});
});
