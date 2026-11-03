import { createReport } from '@quarry/shared/tools';
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
		systolicMmHg: null,
		diastolicMmHg: null,
		heartRateBpm: null,
		respiratoryRate: null,
		temperatureC: null,
		spo2Pct: null,
		weightKg: null,
		heightCm: null,
		bmi: null,
		bloodGlucoseMgDl: null,
		painScore: null,
		...values,
	}) as unknown as PatientSummaryData['trendVitals'][number];

const result = (day: string, code: string, value: number) =>
	({
		resultedAt: at(day),
		code,
		display: code === '4548-4' ? 'Hemoglobin A1c' : 'Fasting glucose',
		value: String(value),
		valueNumeric: value,
		unit: code === '4548-4' ? '%' : 'mg/dL',
		refRange: null,
		flag: 'high',
	}) as unknown as PatientSummaryData['trendResults'][number];

describe('trend charts', () => {
	it('draws blood pressure with the 140/90 thresholds, skipping readings without BP', () => {
		const chart = buildTrendChart(
			'blood_pressure',
			[
				vitals('2026-07-24', { systolicMmHg: 138, diastolicMmHg: 88 }),
				vitals('2026-08-01', { heartRateBpm: 80 }),
				vitals('2026-10-22', { systolicMmHg: 140, diastolicMmHg: 90 }),
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
			givenName: 'Maria',
			familyName: 'Santos',
			birthDate: new Date('1981-04-12T00:00:00Z'),
			sex: 'female',
			consentAt: null,
			identifiers: [{ system: 'MRN', value: 'THC-0001', organization: { name: 'Health Center' } }],
			allergies: [],
		} as unknown as PatientSummaryData['patient'],
		diagnoses: [
			{
				icd10Code: 'R03.0',
				display: 'Elevated BP reading',
				isPrimary: true,
				encounter: { startedAt: at('2026-01-25') },
			},
			{
				icd10Code: 'R03.0',
				display: 'Elevated BP reading',
				isPrimary: true,
				encounter: { startedAt: at('2026-07-24') },
			},
			{
				icd10Code: 'R53',
				display: 'Malaise and fatigue',
				isPrimary: false,
				encounter: { startedAt: at('2026-10-22') },
			},
			{
				icd10Code: 'I10',
				display: 'Essential hypertension',
				isPrimary: true,
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
						dose: '1 tablet',
						route: 'oral',
						frequency: 'once a day',
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
						dose: '1 tablet',
						route: 'oral',
						frequency: 'once a day',
						durationDays: 30,
					},
				],
			},
		] as unknown as PatientSummaryData['prescriptions'],
		latestVitals: [
			vitals('2026-10-22', { systolicMmHg: 138, diastolicMmHg: 88 }),
			vitals('2026-10-21', { systolicMmHg: 140, diastolicMmHg: 90, weightKg: 72 }),
		],
		recentResults: [result('2026-10-24', '4548-4', 7.2)],
		encounters: [],
		trendVitals: [vitals('2026-10-22', { systolicMmHg: 138, diastolicMmHg: 88 })],
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
			rows: [['Amlodipine 5 mg', '1 tablet, oral, once a day', '30 days', '2026-10-22']],
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
		openOrders: [
			{ sentAt: at('2026-11-02'), createdAt: at('2026-11-02') },
			{ sentAt: null, createdAt: at('2026-10-30') },
			{ sentAt: at('2026-10-01'), createdAt: at('2026-10-01') },
		],
		awaitingReview: [{ flag: 'high' }, { flag: 'critical_high' }, { flag: 'high' }],
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

	it('ages open orders from when they were sent (or created), in fixed buckets', () => {
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
		startedAt: at('2026-10-22'),
		followUpOn: null,
		reason: 'Fatigue',
		history: '2 weeks of fatigue',
		physicalExam: '  ',
		assessment: 'Stage 1 hypertension',
		plan: null,
		patientInstructions: null,
		notes: null,
		organization: { name: 'Health Center' },
		doctor: { name: 'Dr. Reyes' },
		patient: {
			givenName: 'Maria',
			familyName: 'Santos',
			birthDate: new Date('1981-04-12T00:00:00Z'),
			sex: 'female',
			identifiers: [{ system: 'MRN', value: 'THC-0001' }],
			allergies: [{ substance: 'Penicillin' }],
		},
		vitalSigns: [vitals('2026-10-22', { systolicMmHg: 140, diastolicMmHg: 90, spo2Pct: 98 })],
		diagnoses: [{ icd10Code: 'I10', display: 'Essential hypertension', certainty: 'provisional', isPrimary: true }],
		orders: [
			{
				code: '4548-4',
				display: 'Hemoglobin A1c',
				status: 'reviewed',
				results: [result('2026-10-24', '4548-4', 7.2)],
			},
			{ code: '57698-3', display: 'Lipid panel', status: 'sent', results: [] },
		],
		prescriptions: [],
		certificates: [],
	} as unknown as Parameters<typeof buildEncounterSummarySections>[0];
	const sections = buildEncounterSummarySections(encounter, TODAY);

	it('keeps only the note fields that were written, in SOAP order', () => {
		expect(sections.filter((section) => section.kind === 'text').map((section) => section.title)).toEqual([
			'History',
			'Assessment',
		]);
	});

	it('lists each order with its results, and orders still waiting', () => {
		expect(sections.find((section) => section.title === 'Orders and results')).toMatchObject({
			rows: [
				['Hemoglobin A1c', 'reviewed', '7.2 %', 'high', '2026-10-24'],
				['Lipid panel', 'sent', '—', '—', '—'],
			],
		});
	});

	it('names the visit, the facility, the clinician and the allergies', () => {
		expect(sections[0]).toMatchObject({
			facts: expect.arrayContaining([
				{ label: 'MRN', value: 'THC-0001' },
				{ label: 'Facility', value: 'Health Center' },
				{ label: 'Clinician', value: 'Dr. Reyes' },
				{ label: 'Allergies', value: 'Penicillin' },
			]),
		});
	});
});
