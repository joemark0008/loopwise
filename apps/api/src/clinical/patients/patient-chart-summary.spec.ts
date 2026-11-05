import { describe, expect, it } from 'vitest';

import { Prisma } from '../../generated/prisma/client.js';
import type { PatientChartRow } from './patient-chart.repository.js';
import { ageOn, physicalExamText, renderChartSummary } from './patient-chart-summary.js';

const patient = {
	patientNo: 'TAG-PT-2026-000001',
	firstName: 'Maria',
	middleName: 'Reyes',
	lastName: 'Santos',
	suffix: null,
	birthDate: new Date('1981-04-12T00:00:00Z'),
	sex: 'FEMALE',
	mobileNo: null,
	preferredLanguage: 'ceb',
	addresses: [{ barangay: { name: 'Cogon' } }],
	consents: [{ signedAt: new Date('2026-10-04T00:00:00Z') }],
	identifications: [{ type: 'PHILHEALTH_ID', idNumber: '12-345678901-2' }],
	allergies: [{ allergen: 'Penicillin', reaction: 'Hives' }],
	encounters: [
		{
			id: 'e1',
			encounterNo: 'TAG-ENC-2026-000001',
			type: 'CONSULTATION',
			status: 'COMPLETED',
			startedAt: new Date('2026-10-20T01:00:00Z'),
			chiefComplaint: 'Fatigue',
			historyOfPresentIllness: null,
			physicalExam: 'BP 140/90,\nno edema',
			assessment: 'Hypertension',
			plan: 'HbA1c,\nFBS',
			notes: null,
			patientInstructions: null,
			followUpDate: new Date('2026-11-20T00:00:00Z'),
			disposition: 'FOR_FOLLOW_UP',
			clinic: { name: 'Tagbilaran City Health Center' },
		},
	],
} as unknown as PatientChartRow;

describe('renderChartSummary', () => {
	it('tells Wise the patient, allergies, problems, medicines, vitals, results and latest visits with their ids', () => {
		const summary = renderChartSummary(
			{
				patient,
				diagnoses: [
					{ icd10Code: 'I10', description: 'Essential (primary) hypertension' },
					{ icd10Code: 'I10', description: 'Essential (primary) hypertension' },
				],
				vitals: {
					recordedAt: new Date('2026-10-20T01:00:00Z'),
					systolicBp: 140,
					diastolicBp: 90,
					weightKg: new Prisma.Decimal(72),
					bmi: new Prisma.Decimal(30),
				},
				medicines: [{ genericName: 'Amlodipine', strength: '5 mg', frequency: 'once a day' }],
				results: [
					{
						resultId: 'r1',
						resultedAt: new Date('2026-10-22T00:00:00Z'),
						name: 'Hemoglobin A1c',
						value: '7.2',
						unit: '%',
						flag: 'HIGH',
					},
				],
			},
			new Date('2026-11-03T00:00:00Z'),
		);
		expect(summary).toBe(
			[
				'- Name: Maria Reyes Santos',
				'- Patient no.: TAG-PT-2026-000001',
				'- Born 1981-04-12 (age 45), sex FEMALE',
				'- Preferred language: ceb; mobile: none on file',
				'- Barangay: Cogon',
				'- Data-privacy consent: signed 2026-10-04',
				'- PhilHealth 12-345678901-2',
				'- Allergies: Penicillin (Hives)',
				'- Problems (ICD-10): Essential (primary) hypertension (I10)',
				'- Prescribed (issued): Amlodipine 5 mg once a day',
				'- Latest vitals (2026-10-20): BP 140/90 mmHg, weight 72 kg, BMI 30',
				'- Latest results (newest first):',
				'  - 2026-10-22 [result r1] Hemoglobin A1c: 7.2 % (high)',
				'- Latest encounters (newest first, up to 1):',
				'  - 2026-10-20 [encounter e1] TAG-ENC-2026-000001, CONSULTATION, COMPLETED at Tagbilaran City Health Center: Fatigue — Hypertension',
				'    - Exam: BP 140/90, no edema',
				'    - Plan: HbA1c, FBS',
				'    - Follow-up on: 2026-11-20',
				'    - Disposition: FOR_FOLLOW_UP',
			].join('\n'),
		);
	});

	it('says when nothing is recorded yet', () => {
		const summary = renderChartSummary(
			{
				patient: {
					...patient,
					allergies: [],
					encounters: [],
					identifications: [],
					consents: [],
					addresses: [],
				},
				diagnoses: [],
				vitals: null,
				medicines: [],
				results: [],
			},
			new Date('2026-11-03T00:00:00Z'),
		);
		expect(summary).toContain('- Allergies: none recorded');
		expect(summary).toContain('- Data-privacy consent: not on file');
		expect(summary).toContain('- Encounters: none yet');
	});
});

describe('physicalExamText', () => {
	it('reads the free text stored as a JSON string, and the structured form per system', () => {
		expect(physicalExamText('Clear breath sounds')).toBe('Clear breath sounds');
		expect(physicalExamText({ heent: 'Pink conjunctivae', chest: 'Clear' })).toBe(
			'heent: Pink conjunctivae; chest: Clear',
		);
		expect(physicalExamText(null)).toBeNull();
		expect(physicalExamText('')).toBeNull();
	});
});

describe('ageOn', () => {
	it('counts a birthday only once reached', () => {
		expect(ageOn(new Date('1981-11-04T00:00:00Z'), new Date('2026-11-03T00:00:00Z'))).toBe(44);
		expect(ageOn(new Date('1981-11-03T00:00:00Z'), new Date('2026-11-03T00:00:00Z'))).toBe(45);
	});
});
