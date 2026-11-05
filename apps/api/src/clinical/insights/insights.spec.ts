import { createReport } from '@loopwise/shared/tools';
import { describe, expect, it } from 'vitest';

import { buildEncounterSummarySections } from './encounter-summary.js';
import { reportFilename } from './insights.service.js';
import { buildPanelChart, weekStart } from './panel-chart.js';
import { buildPatientSummarySections, type PatientSummaryData } from './patient-summary.js';
import { renderReportHtml } from './report-pdf/report-html.js';
import { buildTrendChart } from './trend-chart.js';

const at = (day: string) => new Date(`${day}T08:00:00Z`);
const TODAY = at('2026-11-03');

const vitals = (day: string, values: Record<string, number | null>) =>
	({
		recordedAt: at(day),
		systolicBp: null,
		diastolicBp: null,
		heartRate: null,
		respiratoryRate: null,
		temperatureC: null,
		oxygenSaturation: null,
		weightKg: null,
		heightCm: null,
		bmi: null,
		bloodGlucose: null,
		painScore: null,
		...values,
	}) as unknown as PatientSummaryData['trendVitals'][number];

const result = (day: string, code: string, value: number): PatientSummaryData['trendResults'][number] => ({
	resultId: `r-${day}-${code}`,
	resultedAt: at(day),
	code,
	name: code === '4548-4' ? 'Hemoglobin A1c' : 'Fasting glucose',
	value: String(value),
	valueNumeric: value,
	unit: code === '4548-4' ? '%' : 'mg/dL',
	referenceRange: null,
	flag: 'HIGH',
});

describe('trend charts', () => {
	it('draws blood pressure with the 140/90 thresholds, skipping readings without BP', () => {
		const chart = buildTrendChart(
			'blood_pressure',
			[
				vitals('2026-07-24', { systolicBp: 138, diastolicBp: 88 }),
				vitals('2026-08-01', { heartRate: 80 }),
				vitals('2026-10-22', { systolicBp: 140, diastolicBp: 90 }),
			],
			[],
		);
		expect(chart.rows).toEqual([
			{ date: '2026-07-24', systolic: 138, diastolic: 88, systolic_threshold: 140, diastolic_threshold: 90 },
			{ date: '2026-10-22', systolic: 140, diastolic: 90, systolic_threshold: 140, diastolic_threshold: 90 },
		]);
		expect(chart.series.map((series) => series.label)).toEqual([
			'Systolic',
			'Diastolic',
			'Systolic 140',
			'Diastolic 90',
		]);
	});

	it('puts BMI on the right axis of a mixed weight chart', () => {
		const chart = buildTrendChart('weight_bmi', [vitals('2026-10-22', { weightKg: 72, bmi: 30 })], []);
		expect(chart).toMatchObject({ chartType: 'mixed', rows: [{ date: '2026-10-22', weight: 72, bmi: 30 }] });
		expect(chart.series.find((series) => series.data_key === 'bmi')?.y_axis).toBe('right');
	});

	it('charts only the results of its own LOINC code, with the diabetes threshold', () => {
		const chart = buildTrendChart(
			'hba1c',
			[],
			[
				result('2026-04-27', '4548-4', 6.1),
				result('2026-04-27', '1558-6', 112),
				result('2026-10-24', '4548-4', 7.2),
			],
		);
		expect(chart.rows).toEqual([
			{ date: '2026-04-27', value: 6.1, threshold: 6.5 },
			{ date: '2026-10-24', value: 7.2, threshold: 6.5 },
		]);
	});
});

describe('patient summary sections', () => {
	const data: PatientSummaryData = {
		patient: {
			firstName: 'Maria',
			lastName: 'Santos',
			patientNo: 'TAG-PT-2026-000001',
			birthDate: new Date('1981-04-12T00:00:00Z'),
			sex: 'FEMALE',
			consents: [],
			identifications: [{ type: 'PHILHEALTH_ID', idNumber: 'SYN-0000-0001' }],
			allergies: [],
		} as unknown as PatientSummaryData['patient'],
		diagnoses: [
			{
				icd10Code: 'R03.0',
				description: 'Elevated BP reading',
				type: 'PRIMARY',
				encounter: { startedAt: at('2026-01-25') },
			},
			{
				icd10Code: 'R03.0',
				description: 'Elevated BP reading',
				type: 'PRIMARY',
				encounter: { startedAt: at('2026-07-24') },
			},
			{
				icd10Code: 'R53',
				description: 'Malaise and fatigue',
				type: 'SECONDARY',
				encounter: { startedAt: at('2026-10-22') },
			},
			{
				icd10Code: 'I10',
				description: 'Essential hypertension',
				type: 'PRIMARY',
				encounter: { startedAt: at('2026-10-22') },
			},
		] as unknown as PatientSummaryData['diagnoses'],
		prescriptions: [
			{
				issuedAt: at('2026-10-22'),
				items: [
					{
						genericName: 'Amlodipine',
						strength: '5 mg',
						sig: '1 tablet once a day',
						durationDays: 30,
					},
				],
			},
			{
				issuedAt: at('2026-09-01'),
				items: [
					{
						genericName: 'Amlodipine',
						strength: '5 mg',
						sig: '1 tablet once a day',
						durationDays: 30,
					},
				],
			},
		] as unknown as PatientSummaryData['prescriptions'],
		latestVitals: [
			vitals('2026-10-22', { systolicBp: 138, diastolicBp: 88 }),
			vitals('2026-10-21', { systolicBp: 140, diastolicBp: 90, weightKg: 72 }),
		],
		recentResults: [result('2026-10-24', '4548-4', 7.2)],
		encounters: [],
		trendVitals: [vitals('2026-10-22', { systolicBp: 138, diastolicBp: 88 })],
		trendResults: [],
		charts: ['blood_pressure'],
	};
	const sections = buildPatientSummarySections(data, TODAY);
	const section = (title: string) => sections.find((candidate) => candidate.title === title)!;

	it('groups diagnoses by ICD-10 code with first and last seen, primary and latest first', () => {
		expect(section('Problems and diagnoses')).toMatchObject({
			rows: [
				['I10', 'Essential hypertension', '2026-10-22', '2026-10-22'],
				['R03.0', 'Elevated BP reading', '2026-01-25', '2026-07-24'],
				['R53', 'Malaise and fatigue', '2026-10-22', '2026-10-22'],
			],
		});
	});

	it('lists each medicine once, from its latest prescription', () => {
		expect(section('Current medicines (issued in the last 180 days)')).toMatchObject({
			rows: [['Amlodipine 5 mg', '1 tablet once a day', '30 days', '2026-10-22']],
		});
	});

	it('takes the latest value of each vital sign, which may come from an older reading', () => {
		expect(section('Latest vital signs')).toMatchObject({
			facts: [
				{ label: 'Blood pressure', value: '138/88 mmHg (2026-10-22)' },
				{ label: 'Weight', value: '72 kg (2026-10-21)' },
			],
		});
	});

	it('says an empty section is empty rather than leaving it out', () => {
		expect(section('Allergies')).toMatchObject({ rows: [], empty: 'No known allergies recorded.' });
		expect(section('Encounters')).toMatchObject({ rows: [], empty: 'No encounters yet.' });
	});

	const snapshot: createReport.Snapshot = {
		type: 'patient_summary',
		title: 'Patient clinical summary',
		subject: 'Maria Santos · F · 45 y',
		patientId: 'p1',
		facility: null,
		generatedAt: TODAY.toISOString(),
		generatedBy: 'Dr. Reyes',
		months: 12,
		sections,
	};

	it('refuses narrative numbers the sections lack, allowing small counts and years', () => {
		expect(
			createReport.ungroundedNumbers('BP 138/88 on 2026-10-22; HbA1c 7.20% after 3 visits.', snapshot),
		).toEqual([]);
		expect(createReport.ungroundedNumbers('HbA1c 9.4%, BP 150/95.', snapshot)).toEqual(['9.4', '150', '95']);
	});

	it('prints as static HTML with the watermark, the narrative and inline SVG charts', () => {
		const html = renderReportHtml({ _version: '1', snapshot, narrative: 'BP <b>high</b>.' });
		expect(html).toContain(createReport.WATERMARK);
		expect(html).toContain('BP &lt;b&gt;high&lt;/b&gt;.');
		expect(html).toContain('<svg');
		expect(html).not.toMatch(/undefined|NaN|<script/);
	});

	it('names the PDF after the type, the family name and the day', () => {
		expect(reportFilename(snapshot)).toBe('patient-summary-santos-2026-11-03.pdf');
	});
});

describe('facility panel charts', () => {
	const since = at('2026-10-06');
	const data = {
		encounters: [{ startedAt: at('2026-10-07') }, { startedAt: at('2026-10-08') }, { startedAt: at('2026-10-29') }],
		diagnoses: [{ icd10Code: 'I10' }, { icd10Code: 'E11.9' }, { icd10Code: 'i10' }, { icd10Code: '???' }],
		openOrders: [{ createdAt: at('2026-11-02') }, { createdAt: at('2026-10-30') }, { createdAt: at('2026-10-01') }],
		awaitingReview: [{ flag: 'HIGH' }, { flag: 'CRITICAL_HIGH' }, { flag: 'HIGH' }],
	};

	it('counts encounters per Monday-started week, keeping empty weeks', () => {
		expect(weekStart(at('2026-11-01'))).toBe('2026-10-26');
		expect(buildPanelChart('encounters_by_week', data, since, TODAY).rows).toEqual([
			{ week: '2026-10-05', encounters: 2 },
			{ week: '2026-10-12', encounters: 0 },
			{ week: '2026-10-19', encounters: 0 },
			{ week: '2026-10-26', encounters: 1 },
			{ week: '2026-11-02', encounters: 0 },
		]);
	});

	it('groups diagnoses by ICD-10 chapter, largest first', () => {
		expect(buildPanelChart('diagnoses_by_icd10_chapter', data, since, TODAY).rows).toEqual([
			{ chapter: 'Circulatory system (I00–I99)', diagnoses: 2 },
			{ chapter: 'Endocrine, nutritional and metabolic (E00–E90)', diagnoses: 1 },
			{ chapter: 'Other codes', diagnoses: 1 },
		]);
	});

	it('ages open orders from when they were created, in fixed buckets', () => {
		expect(buildPanelChart('open_orders_by_age', data, since, TODAY).rows).toEqual([
			{ age: '0–2 days', orders: 1 },
			{ age: '3–7 days', orders: 1 },
			{ age: '8–14 days', orders: 0 },
			{ age: 'Over 14 days', orders: 1 },
		]);
	});

	it('counts results awaiting review by flag, critical first', () => {
		expect(buildPanelChart('results_awaiting_review', data, since, TODAY).rows).toEqual([
			{ flag: 'critical high', results: 1 },
			{ flag: 'high', results: 2 },
		]);
	});
});

describe('encounter summary sections', () => {
	const encounter = {
		patientId: 'p1',
		encounterNo: 'TAG-ENC-2026-000001',
		type: 'CONSULTATION',
		status: 'COMPLETED',
		startedAt: at('2026-10-22'),
		followUpDate: null,
		disposition: null,
		chiefComplaint: 'Fatigue',
		historyOfPresentIllness: '2 weeks of fatigue',
		physicalExam: '  ',
		assessment: 'Stage 1 hypertension',
		plan: null,
		patientInstructions: null,
		notes: null,
		clinic: { name: 'Health Center', organizationId: 'o1' },
		practitioner: {
			title: 'Dra.',
			firstName: 'Ana',
			middleName: null,
			lastName: 'Reyes',
			suffix: null,
			postNominals: 'MD',
		},
		patient: {
			firstName: 'Maria',
			lastName: 'Santos',
			patientNo: 'TAG-PT-2026-000001',
			birthDate: new Date('1981-04-12T00:00:00Z'),
			sex: 'FEMALE',
			allergies: [{ allergen: 'Penicillin' }],
		},
		vitals: [vitals('2026-10-22', { systolicBp: 140, diastolicBp: 90, oxygenSaturation: 98 })],
		diagnosis: [{ icd10Code: 'I10', description: 'Essential hypertension', type: 'PRIMARY', isFinal: false }],
		diagnosticOrders: [
			{
				items: [
					{
						status: 'RELEASED',
						test: { name: 'Hemoglobin A1c' },
						result: {
							resultedAt: at('2026-10-24'),
							values: [{ name: 'HbA1c', value: '7.2', unit: '%', flag: 'HIGH' }],
						},
					},
					{ status: 'REQUESTED', test: { name: 'Lipid panel' }, result: null },
				],
			},
		],
		prescriptions: [],
		medicalCertificates: [],
	} as unknown as Parameters<typeof buildEncounterSummarySections>[0];
	const sections = buildEncounterSummarySections(encounter, TODAY);

	it('keeps only the note fields that were written, in SOAP order', () => {
		expect(sections.filter((section) => section.kind === 'text').map((section) => section.title)).toEqual([
			'History of present illness',
			'Assessment',
		]);
	});

	it('lists each ordered test with its values, and tests still waiting', () => {
		expect(sections.find((section) => section.title === 'Orders and results')).toMatchObject({
			rows: [
				['Hemoglobin A1c', 'RELEASED', '7.2 %', 'HIGH', '2026-10-24'],
				['Lipid panel', 'REQUESTED', '—', '—', '—'],
			],
		});
	});

	it('names the visit, the clinic, the doctor and the allergies', () => {
		expect(sections[0]).toMatchObject({
			facts: expect.arrayContaining([
				{ label: 'Patient no.', value: 'TAG-PT-2026-000001' },
				{ label: 'Visit no.', value: 'TAG-ENC-2026-000001' },
				{ label: 'Clinic', value: 'Health Center' },
				{ label: 'Doctor', value: 'Dra. Ana Reyes, MD' },
				{ label: 'Allergies', value: 'Penicillin' },
			]),
		});
	});
});
