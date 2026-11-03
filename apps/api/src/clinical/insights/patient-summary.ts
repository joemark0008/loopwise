import type { chartPatientTrend, createReport } from '@loopwise/shared/tools';

import type { Prisma } from '../../generated/prisma/client.js';
import type { EncounterSummaryRow, PatientHeaderRow, PrescriptionRow } from './insights.repository.js';
import { buildTrendChart } from './trend-chart.js';

type Section = createReport.Section;
type Vitals = Prisma.VitalSignsGetPayload<object>;
type Result = Prisma.ResultGetPayload<object>;
type Diagnosis = Prisma.EncounterDiagnosisGetPayload<{ include: { encounter: { select: { startedAt: true } } } }>;

export interface PatientSummaryData {
	patient: PatientHeaderRow;
	diagnoses: Diagnosis[];
	prescriptions: PrescriptionRow[];
	/** Newest first. */
	latestVitals: Vitals[];
	/** Newest first. */
	recentResults: Result[];
	/** Newest first. */
	encounters: EncounterSummaryRow[];
	/** Oldest first, over the report's period. */
	trendVitals: Vitals[];
	/** Oldest first, over the report's period. */
	trendResults: Result[];
	charts: chartPatientTrend.PatientMeasure[];
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export function ageOn(birthDate: Date, today: Date): number {
	const hadBirthday =
		today.getUTCMonth() > birthDate.getUTCMonth() ||
		(today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
	return today.getUTCFullYear() - birthDate.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

export function patientSubject(patient: PatientHeaderRow, today: Date): string {
	const sex = { female: 'F', male: 'M' }[patient.sex as string] ?? patient.sex;
	return `${patient.givenName} ${patient.familyName} · ${sex} · ${ageOn(patient.birthDate, today)} y`;
}

/** The data sections of a patient clinical summary, in reading order. */
export function buildPatientSummarySections(data: PatientSummaryData, today: Date): Section[] {
	const { patient } = data;
	return [
		{
			kind: 'facts',
			title: 'Patient',
			facts: [
				{ label: 'Name', value: `${patient.givenName} ${patient.familyName}` },
				{ label: 'Born', value: `${day(patient.birthDate)} (age ${ageOn(patient.birthDate, today)})` },
				{ label: 'Sex', value: patient.sex },
				...patient.identifiers.map((identifier) => ({
					label: identifier.system,
					value: `${identifier.value} (${identifier.organization.name})`,
				})),
				{ label: 'Consent', value: patient.consentAt ? day(patient.consentAt) : 'not recorded' },
			],
		},
		{
			kind: 'table',
			title: 'Allergies',
			columns: ['Substance', 'Kind', 'Reaction', 'Severity'],
			rows: patient.allergies.map((allergy) => [
				allergy.substance,
				allergy.kind,
				allergy.reaction ?? '—',
				allergy.severity ?? '—',
			]),
			empty: 'No known allergies recorded.',
		},
		problems(data.diagnoses),
		medicines(data.prescriptions),
		latestVitals(data.latestVitals),
		{
			kind: 'table',
			title: 'Recent laboratory results',
			columns: ['Date', 'Test', 'Result', 'Reference', 'Flag'],
			rows: data.recentResults.map((result) => [
				day(result.resultedAt),
				result.display ?? result.code,
				`${result.value}${result.unit ? ` ${result.unit}` : ''}`,
				result.refRange ?? '—',
				result.flag ?? '—',
			]),
			empty: 'No results on file.',
		},
		...data.charts.map((measure): Section => {
			const chart = buildTrendChart(measure, data.trendVitals, data.trendResults);
			return { kind: 'chart', title: chart.title, chart };
		}),
		{
			kind: 'table',
			title: 'Encounters',
			columns: ['Date', 'Reason', 'Primary diagnosis'],
			rows: data.encounters.map((encounter) => {
				const primary = encounter.diagnoses[0];
				return [
					day(encounter.startedAt),
					encounter.reason ?? '—',
					primary ? `${primary.icd10Code} ${primary.display}` : '—',
				];
			}),
			empty: 'No encounters yet.',
		},
	];
}

/** Diagnoses grouped by ICD-10 code, with when they were first and last recorded; primary ones first. */
function problems(diagnoses: Diagnosis[]): Section {
	const byCode = new Map<string, { code: string; display: string; first: Date; last: Date; primary: boolean }>();
	for (const diagnosis of diagnoses) {
		const at = diagnosis.encounter.startedAt;
		const entry = byCode.get(diagnosis.icd10Code);
		if (!entry) {
			byCode.set(diagnosis.icd10Code, {
				code: diagnosis.icd10Code,
				display: diagnosis.display,
				first: at,
				last: at,
				primary: diagnosis.isPrimary,
			});
			continue;
		}
		entry.first = at < entry.first ? at : entry.first;
		entry.last = at > entry.last ? at : entry.last;
		entry.primary ||= diagnosis.isPrimary;
	}
	const rows = [...byCode.values()]
		.sort((a, b) => Number(b.primary) - Number(a.primary) || b.last.getTime() - a.last.getTime())
		.map((entry) => [entry.code, entry.display, day(entry.first), day(entry.last)]);
	return {
		kind: 'table',
		title: 'Problems and diagnoses',
		columns: ['ICD-10', 'Diagnosis', 'First recorded', 'Last recorded'],
		rows,
		empty: 'No diagnoses recorded.',
	};
}

/** Items of issued, non-voided prescriptions: what the patient was last prescribed, newest first, one row a drug. */
function medicines(prescriptions: PrescriptionRow[]): Section {
	const seen = new Set<string>();
	const rows: string[][] = [];
	for (const prescription of prescriptions) {
		for (const item of prescription.items) {
			const key = `${item.genericName}|${item.strength ?? ''}`.toLowerCase();
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			rows.push([
				[item.genericName, item.strength].filter(Boolean).join(' '),
				`${item.dose}, ${item.route}, ${item.frequency}`,
				item.durationDays ? `${item.durationDays} days` : '—',
				prescription.issuedAt ? day(prescription.issuedAt) : '—',
			]);
		}
	}
	return {
		kind: 'table',
		title: 'Current medicines (issued in the last 180 days)',
		columns: ['Medicine', 'Sig', 'Duration', 'Prescribed'],
		rows,
		empty: 'No prescriptions issued in the last 180 days.',
	};
}

/** The latest value of each vital sign, with its date: the latest row may not carry every field. */
function latestVitals(rows: Vitals[]): Section {
	const pick = <T>(label: string, value: (row: Vitals) => T | null, render: (value: T) => string) => {
		const row = rows.find((candidate) => value(candidate) !== null);
		return row ? { label, value: `${render(value(row) as T)} (${day(row.recordedAt)})` } : null;
	};
	const facts = [
		pick(
			'Blood pressure',
			(row) => (row.systolicMmHg !== null ? row : null),
			(row) => `${row.systolicMmHg}/${row.diastolicMmHg ?? '—'} mmHg`,
		),
		pick(
			'Heart rate',
			(row) => row.heartRateBpm,
			(value) => `${value} bpm`,
		),
		pick(
			'Respiratory rate',
			(row) => row.respiratoryRate,
			(value) => `${value} /min`,
		),
		pick(
			'Temperature',
			(row) => row.temperatureC,
			(value) => `${Number(value)} °C`,
		),
		pick(
			'SpO2',
			(row) => row.spo2Pct,
			(value) => `${value}%`,
		),
		pick(
			'Weight',
			(row) => row.weightKg,
			(value) => `${Number(value)} kg`,
		),
		pick(
			'Height',
			(row) => row.heightCm,
			(value) => `${Number(value)} cm`,
		),
		pick(
			'BMI',
			(row) => row.bmi,
			(value) => `${Number(value)}`,
		),
		pick(
			'Capillary glucose',
			(row) => row.bloodGlucoseMgDl,
			(value) => `${value} mg/dL`,
		),
	].filter((fact) => fact !== null);
	return { kind: 'facts', title: 'Latest vital signs', facts };
}
