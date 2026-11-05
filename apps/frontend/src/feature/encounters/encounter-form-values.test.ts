import { describe, expect, it } from 'vitest';
import {
	emptyPrescriptionItem,
	emptyVitalsForm,
	itemSig,
	newCertificateForm,
	toRecordVitalsInput,
	toSaveCertificateInput,
	toSavePrescriptionInput,
	validateCertificateForm,
	validatePrescriptionForm,
	validateVitalsForm,
} from './encounter-form-values';
import { medicineName, quantityLabel, vitalChips } from './encounter-format';
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
		const values = {
			id: null,
			items: [item, { ...item, dose: '' }],
			notes: '',
			isDangerousDrug: false,
			s2FormSerialNo: '',
		};
		expect(validatePrescriptionForm(values)['items.1.sig']).toMatch(/sig/);
		expect(itemSig(item)).toBe('1 tablet by mouth once a day');
		expect(toSavePrescriptionInput('e1', values).items[0]).toMatchObject({
			genericName: 'Amlodipine',
			quantity: 30,
			route: 'PO',
			sig: null,
			brandName: null,
		});
		const dangerous = { ...values, items: [item], isDangerousDrug: true };
		expect(validatePrescriptionForm(dangerous)['items.0.quantityInWords']).toMatch(/words/);
	});

	it('pre-fills a certificate from the visit and leaves out the rest start without rest days', () => {
		const record = {
			encounter: { startedAt: '2026-11-03T01:00:00.000Z' },
			diagnoses: [
				{ description: 'Essential (primary) hypertension', icd10Code: 'I10', voidedAt: null },
				{ description: 'Old', icd10Code: 'R53', voidedAt: '2026-11-03' },
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
		const item = { genericName: 'Amlodipine', brandName: null, strength: '5 mg', dosageForm: 'tablet' };
		expect(medicineName(item)).toBe('Amlodipine 5 mg tablet');
		expect(quantityLabel({ quantity: 10, unit: 'capsules', quantityInWords: 'ten' })).toBe('#10 (ten) capsules');
	});
});
