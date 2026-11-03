import { describe, expect, it } from 'vitest';

import { BillDraftSchema, computeBillTotals } from './encounter-bill';
import { DiagnosisDraftSchema, EncounterNoteSchema, fieldErrors } from './encounter-record';
import { findIcd10, normalizeIcd10Code, searchIcd10 } from './icd10';
import { MedicalCertificateDraftSchema, restUntil } from './medical-certificate';
import { allergyWarnings, PrescriptionDraftSchema } from './prescription';
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
		expect(DiagnosisDraftSchema.parse({ icd10Code: 'j069', display: 'URTI' })).toMatchObject({
			icd10Code: 'J06.9',
			certainty: 'provisional',
			isPrimary: false,
		});
		expect(fieldErrors(DiagnosisDraftSchema, { icd10Code: 'flu', display: 'Flu' }).icd10Code).toMatch(/ICD-10/);
	});
});

describe('encounter note', () => {
	it('needs the chief complaint and a real follow-up date', () => {
		expect(EncounterNoteSchema.parse({ reason: ' BP check ', plan: ' ', followUpOn: '' })).toEqual({
			reason: 'BP check',
		});
		expect(fieldErrors(EncounterNoteSchema, { reason: 'x', followUpOn: '20 Nov' }).followUpOn).toMatch(/date/);
	});
});

describe('prescription', () => {
	const amlodipine = { genericName: 'Amlodipine', dose: '1 tablet', frequency: 'once a day', quantity: '30' };

	it('needs a medicine with dose, frequency and quantity', () => {
		expect(PrescriptionDraftSchema.parse({ items: [amlodipine] }).items[0]).toMatchObject({
			quantity: 30,
			refills: 0,
			route: 'oral',
		});
		expect(fieldErrors(PrescriptionDraftSchema, { items: [] }).items).toMatch(/at least one/);
		expect(fieldErrors(PrescriptionDraftSchema, { items: [{ ...amlodipine, dose: '' }] })['items.0.dose']).toMatch(
			/dose/,
		);
	});

	it('warns about allergies, by name or drug class', () => {
		const items = [
			amlodipine,
			{ genericName: 'Co-amoxiclav' },
			{ genericName: 'Paracetamol', brandName: 'Biogesic' },
		];
		expect(allergyWarnings(items, [{ substance: 'Penicillin' }])).toEqual([
			{ itemIndex: 1, genericName: 'Co-amoxiclav', substance: 'Penicillin' },
		]);
		expect(allergyWarnings(items, [{ substance: 'paracetamol' }]).map((warning) => warning.itemIndex)).toEqual([2]);
		expect(allergyWarnings(items, [{ substance: 'Shrimp' }])).toEqual([]);
	});
});

describe('medical certificate', () => {
	it('needs rest days when unfit and a start date for any rest', () => {
		const base = { examinedOn: '2026-11-03', diagnosisText: 'Acute URTI' };
		expect(MedicalCertificateDraftSchema.parse(base).fitness).toBe('fit_to_work');
		expect(fieldErrors(MedicalCertificateDraftSchema, { ...base, fitness: 'unfit' }).restDays).toMatch(/days/);
		expect(fieldErrors(MedicalCertificateDraftSchema, { ...base, restDays: 2 }).restFrom).toMatch(/from when/);
		expect(restUntil('2026-11-03', 3)).toBe('2026-11-05');
	});
});

describe('encounter bill', () => {
	it('totals charges with the senior discount and PhilHealth, never below zero', () => {
		const charges = [
			{ quantity: 1, unitPrice: 300 },
			{ quantity: 2, unitPrice: 350.5 },
		];
		expect(computeBillTotals(charges)).toMatchObject({ subtotal: 1001, discountAmount: 0, total: 1001 });
		expect(computeBillTotals(charges, 'senior_citizen', 500)).toEqual({
			amounts: [300, 701],
			subtotal: 1001,
			discountAmount: 200.2,
			philhealthCoverage: 500,
			total: 300.8,
		});
		expect(computeBillTotals(charges, 'pwd', 5000)).toMatchObject({ philhealthCoverage: 800.8, total: 0 });
	});

	it('needs a charge with a description and a price of at most 2 decimals', () => {
		expect(fieldErrors(BillDraftSchema, { charges: [] }).charges).toMatch(/at least one/);
		const charge = { kind: 'consultation', description: 'Consultation', quantity: '1', unitPrice: '300.555' };
		expect(fieldErrors(BillDraftSchema, { charges: [charge] })['charges.0.unitPrice']).toMatch(/2 decimals/);
		expect(BillDraftSchema.parse({ charges: [{ ...charge, unitPrice: '300' }], discountKind: '' })).toMatchObject({
			philhealthCoverage: 0,
		});
	});
});
