import { describe, expect, it } from 'vitest';
import {
	billFormFrom,
	billFormTotals,
	emptyPrescriptionItem,
	emptyVitalsForm,
	newCertificateForm,
	toRecordVitalsInput,
	toSaveBillInput,
	toSaveCertificateInput,
	toSavePrescriptionInput,
	validateCertificateForm,
	validatePrescriptionForm,
	validateVitalsForm,
} from './encounter-form-values';
import { medicineName, sig, vitalChips } from './encounter-format';
import type { EncounterRecordFieldsFragment, VitalSignsFieldsFragment } from '@/graphql/generated/graphql';

describe('encounter form values', () => {
	it('sends only the vitals that were entered, as numbers', () => {
		const values = { ...emptyVitalsForm(), systolicMmHg: '140', diastolicMmHg: '90', weightKg: '72.5' };
		expect(validateVitalsForm(values)).toEqual({});
		expect(toRecordVitalsInput('e1', values)).toEqual({
			encounterId: 'e1',
			systolicMmHg: 140,
			diastolicMmHg: 90,
			weightKg: 72.5,
		});
		expect(validateVitalsForm(emptyVitalsForm()).systolicMmHg).toBe('Enter at least one measurement.');
	});

	it('maps a prescription and reports item errors by position', () => {
		const item = {
			...emptyPrescriptionItem(),
			genericName: 'Amlodipine',
			dose: '1 tablet',
			frequency: 'once a day',
			quantity: '30',
		};
		const values = { id: null, items: [item, { ...item, dose: '' }], notes: '' };
		expect(validatePrescriptionForm(values)['items.1.dose']).toMatch(/dose/);
		expect(toSavePrescriptionInput('e1', values).items[0]).toMatchObject({
			genericName: 'Amlodipine',
			quantity: 30,
			refills: 0,
			brandName: null,
		});
	});

	it('pre-fills a certificate from the visit and leaves out the rest start without rest days', () => {
		const record = {
			encounter: { startedAt: '2026-11-03T01:00:00.000Z' },
			diagnoses: [
				{ display: 'Essential (primary) hypertension', icd10Code: 'I10', voidedAt: null },
				{ display: 'Old', icd10Code: 'R53', voidedAt: '2026-11-03' },
			],
		} as unknown as EncounterRecordFieldsFragment;
		const form = newCertificateForm(record);
		expect(form.diagnosisText).toBe('Essential (primary) hypertension (I10)');
		expect(validateCertificateForm(form)).toEqual({});
		expect(toSaveCertificateInput('e1', form)).toMatchObject({ restFrom: null, restDays: null });
		expect(validateCertificateForm({ ...form, fitness: 'unfit' }).restDays).toMatch(/days/);
	});

	it('formats vitals and medicines', () => {
		const vitals = {
			systolicMmHg: 140,
			diastolicMmHg: 90,
			heartRateBpm: 88,
			respiratoryRate: null,
			temperatureC: null,
			spo2Pct: null,
			weightKg: 72,
			heightCm: 155,
			bmi: 30,
			bloodGlucoseMgDl: null,
			painScore: null,
		} as VitalSignsFieldsFragment;
		expect(vitalChips(vitals)).toEqual(['BP 140/90', 'HR 88', 'Wt 72 kg', 'Ht 155 cm', 'BMI 30.0']);
		const item = { genericName: 'Amlodipine', brandName: null, strength: '5 mg', form: 'tablet' };
		expect(medicineName(item)).toBe('Amlodipine 5 mg tablet');
		expect(sig({ dose: '1 tablet', frequency: 'once a day', durationDays: 30, route: 'oral' })).toBe(
			'1 tablet, once a day, for 30 days',
		);
	});

	it('pre-fills a new bill with the consultation and the ordered tests, and totals it', () => {
		const record = {
			bills: [],
			orders: [{ code: '4548-4' }, { code: 'LOCAL-1' }],
		} as unknown as EncounterRecordFieldsFragment;
		const form = billFormFrom(record);
		expect(form.charges.map((charge) => charge.description)).toEqual(['Consultation', 'Hemoglobin A1c']);
		const totals = billFormTotals({ ...form, discountKind: 'senior_citizen', philhealthCoverage: '100' });
		expect(totals).toMatchObject({ subtotal: 650, discountAmount: 130, total: 420 });
		expect(toSaveBillInput('e1', form)).toMatchObject({
			encounterId: 'e1',
			discountKind: null,
			philhealthCoverage: null,
			charges: [{ kind: 'consultation', quantity: 1, unitPrice: 300, code: 'CONSULT' }, { code: '4548-4' }],
		});
	});
});
