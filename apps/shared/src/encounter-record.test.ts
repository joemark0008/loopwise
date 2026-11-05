import { describe, expect, it } from 'vitest';

import { DiagnosisDraftSchema, EncounterNoteSchema, fieldErrors } from './encounter-record';
import { findIcd10, normalizeIcd10Code, searchIcd10 } from './icd10';
import { MedicalCertificateDraftSchema, ReferralDraftSchema, restUntil } from './medical-certificate';
import { allergyWarnings, composeSig, PrescriptionDraftSchema } from './prescription';
import { bmiCategory, computeBmi, vitalsDraftErrors, VitalsDraftSchema } from './vitals';

describe('vitals', () => {
	it('coerces form strings, drops empty fields and computes the BMI', () => {
		expect(
			VitalsDraftSchema.parse({ systolicMmHg: '140', diastolicMmHg: '90', heartRateBpm: '', weightKg: '72' }),
		).toEqual({ systolicMmHg: 140, diastolicMmHg: 90, weightKg: 72 });
		expect(computeBmi(72, 155)).toBe(30);
		expect(computeBmi(72, undefined)).toBeUndefined();
		expect(bmiCategory(22.9)).toBe('normal');
		expect(bmiCategory(24)).toBe('overweight');
	});

	it('needs one measurement, both blood pressures, diastolic below systolic and plausible values', () => {
		expect(vitalsDraftErrors({}).systolicMmHg).toBe('Enter at least one measurement.');
		expect(vitalsDraftErrors({ systolicMmHg: 140 }).diastolicMmHg).toMatch(/both/);
		expect(vitalsDraftErrors({ systolicMmHg: 90, diastolicMmHg: 120 }).diastolicMmHg).toMatch(/below/);
		expect(vitalsDraftErrors({ temperatureC: 52 }).temperatureC).toMatch(/at most 45/);
		expect(vitalsDraftErrors({ heartRateBpm: 80.5 }).heartRateBpm).toMatch(/whole/);
	});
});

describe('ICD-10', () => {
	it('normalizes codes and searches by code or title words', () => {
		expect(normalizeIcd10Code(' e119 ')).toBe('E11.9');
		expect(findIcd10('i10')?.title).toBe('Essential (primary) hypertension');
		expect(searchIcd10('E11').map((entry) => entry.code)).toEqual(['E11.2', 'E11.5', 'E11.9']);
		expect(searchIcd10('diabetes without').map((entry) => entry.code)).toContain('E11.9');
	});

	it('accepts any well-formed code but not free text', () => {
		expect(DiagnosisDraftSchema.parse({ icd10Code: 'j069', description: 'URTI' })).toEqual({
			icd10Code: 'J06.9',
			description: 'URTI',
			isFinal: true,
		});
		expect(fieldErrors(DiagnosisDraftSchema, { icd10Code: 'flu', description: 'Flu' }).icd10Code).toMatch(/ICD-10/);
	});
});

describe('encounter note', () => {
	it('needs the chief complaint and a real follow-up date', () => {
		expect(EncounterNoteSchema.parse({ reason: ' BP check ', plan: ' ', followUpOn: '', disposition: '' })).toEqual(
			{
				reason: 'BP check',
			},
		);
		expect(fieldErrors(EncounterNoteSchema, { reason: 'x', followUpOn: '20 Nov' }).followUpOn).toMatch(/date/);
	});
});

describe('prescription', () => {
	const amlodipine = { genericName: 'Amlodipine', dose: '1 tablet', frequency: 'once a day', quantity: '30' };

	it('needs a medicine with directions and a quantity, and writes the sig', () => {
		expect(PrescriptionDraftSchema.parse({ items: [amlodipine] }).items[0]).toMatchObject({
			quantity: 30,
			isPrn: false,
			sig: '1 tablet by mouth once a day',
		});
		expect(composeSig({ dose: '1 capsule', route: 'PO', frequency: 'every 8 hours', durationDays: 7 })).toBe(
			'1 capsule by mouth every 8 hours for 7 days',
		);
		expect(fieldErrors(PrescriptionDraftSchema, { items: [] }).items).toMatch(/at least one/);
		expect(fieldErrors(PrescriptionDraftSchema, { items: [{ ...amlodipine, dose: '' }] })['items.0.sig']).toMatch(
			/sig/,
		);
		expect(fieldErrors(PrescriptionDraftSchema, { items: [{ ...amlodipine, quantity: '1.555' }] })).toHaveProperty(
			'items.0.quantity',
		);
	});

	it('needs the quantity in words for a dangerous drug (RA 9165)', () => {
		const items = [{ genericName: 'Tramadol', sig: '1 capsule every 8 hours as needed', quantity: 10 }];
		expect(
			fieldErrors(PrescriptionDraftSchema, { isDangerousDrug: true, items })['items.0.quantityInWords'],
		).toMatch(/words/);
		expect(
			PrescriptionDraftSchema.parse({
				isDangerousDrug: true,
				items: [{ ...items[0], quantityInWords: 'ten (10)' }],
			}).items[0].quantityInWords,
		).toBe('ten (10)');
	});

	it('warns about allergies, by generic name or drug class', () => {
		const items = [
			amlodipine,
			{ genericName: 'Co-amoxiclav' },
			{ genericName: 'Paracetamol', brandName: 'Biogesic' },
		];
		expect(allergyWarnings(items, [{ allergen: 'Penicillin' }])).toEqual([
			{ itemIndex: 1, genericName: 'Co-amoxiclav', allergen: 'Penicillin' },
		]);
		expect(allergyWarnings(items, [{ allergen: 'paracetamol' }]).map((warning) => warning.itemIndex)).toEqual([2]);
		expect(allergyWarnings(items, [{ allergen: 'Shrimp' }])).toEqual([]);
	});
});

describe('medical certificate', () => {
	it('needs rest days when unfit and a start date for any rest', () => {
		const base = { examinedOn: '2026-11-03', diagnosisText: 'Acute URTI' };
		expect(MedicalCertificateDraftSchema.parse(base).type).toBe('MEDICAL_CERTIFICATE');
		expect(fieldErrors(MedicalCertificateDraftSchema, { ...base, isFitToWork: false }).restDays).toMatch(/days/);
		expect(fieldErrors(MedicalCertificateDraftSchema, { ...base, restDays: 2 }).restFrom).toMatch(/from when/);
		expect(restUntil('2026-11-03', 3)).toBe('2026-11-05');
	});
});

describe('referral', () => {
	it('needs a target', () => {
		expect(fieldErrors(ReferralDraftSchema, { reason: 'For IM evaluation' }).toPractitionerId).toMatch(/Refer/);
		expect(ReferralDraftSchema.parse({ reason: 'For CT scan', toFacility: 'GCGMMC' }).urgency).toBe('ROUTINE');
	});
});
