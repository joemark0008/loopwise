import type { createReport } from '@loopwise/shared/tools';

import type { EncounterRecordRow } from './insights.repository.js';
import { ageOn } from './patient-summary.js';

type Section = createReport.Section;

const day = (date: Date) => date.toISOString().slice(0, 10);
const dash = (value: string | number | null | undefined) =>
	value === null || value === undefined || value === '' ? '—' : String(value);

/** The data sections of one visit's summary: who, when and where, the note, then what was recorded and ordered. */
export function buildEncounterSummarySections(encounter: EncounterRecordRow, today: Date): Section[] {
	const { patient } = encounter;
	const mrn = patient.identifiers.find((identifier) => identifier.system === 'MRN');
	const sections: Section[] = [
		{
			kind: 'facts',
			title: 'Visit',
			facts: [
				{ label: 'Patient', value: `${patient.givenName} ${patient.familyName}` },
				{ label: 'Age, sex', value: `${ageOn(patient.birthDate, today)}, ${patient.sex}` },
				...(mrn ? [{ label: 'MRN', value: mrn.value }] : []),
				{ label: 'Date', value: day(encounter.startedAt) },
				{ label: 'Facility', value: encounter.organization.name },
				{ label: 'Clinician', value: encounter.doctor.name },
				{ label: 'Reason', value: dash(encounter.reason) },
				{ label: 'Follow-up', value: encounter.followUpOn ? day(encounter.followUpOn) : 'none set' },
				{
					label: 'Allergies',
					value:
						patient.allergies.length === 0
							? 'none recorded'
							: patient.allergies.map((allergy) => allergy.substance).join(', '),
				},
			],
		},
	];
	for (const [title, text] of [
		['History', encounter.history],
		['Physical examination', encounter.physicalExam],
		['Assessment', encounter.assessment],
		['Plan', encounter.plan],
		['Patient instructions', encounter.patientInstructions],
		['Notes', encounter.notes],
	] as const) {
		if (text?.trim()) {
			sections.push({ kind: 'text', title, text: text.trim() });
		}
	}
	sections.push(
		{
			kind: 'table',
			title: 'Vital signs',
			columns: ['Time', 'BP (mmHg)', 'HR', 'RR', 'Temp (°C)', 'SpO2', 'Weight (kg)', 'BMI', 'Glucose (mg/dL)'],
			rows: encounter.vitalSigns.map((vitals) => [
				vitals.recordedAt.toISOString().slice(11, 16),
				vitals.systolicMmHg === null ? '—' : `${vitals.systolicMmHg}/${dash(vitals.diastolicMmHg)}`,
				dash(vitals.heartRateBpm),
				dash(vitals.respiratoryRate),
				dash(vitals.temperatureC === null ? null : Number(vitals.temperatureC)),
				vitals.spo2Pct === null ? '—' : `${vitals.spo2Pct}%`,
				dash(vitals.weightKg === null ? null : Number(vitals.weightKg)),
				dash(vitals.bmi === null ? null : Number(vitals.bmi)),
				dash(vitals.bloodGlucoseMgDl),
			]),
			empty: 'No vital signs recorded at this visit.',
		},
		{
			kind: 'table',
			title: 'Diagnoses',
			columns: ['ICD-10', 'Diagnosis', 'Certainty', 'Primary'],
			rows: encounter.diagnoses.map((diagnosis) => [
				diagnosis.icd10Code,
				diagnosis.display,
				diagnosis.certainty,
				diagnosis.isPrimary ? 'yes' : '',
			]),
			empty: 'No diagnoses recorded.',
		},
		{
			kind: 'table',
			title: 'Orders and results',
			columns: ['Test', 'Status', 'Result', 'Flag', 'Resulted'],
			rows: encounter.orders.flatMap((order) =>
				order.results.length === 0
					? [[order.display ?? order.code, order.status, '—', '—', '—']]
					: order.results.map((result) => [
							order.display ?? order.code,
							order.status,
							`${result.value}${result.unit ? ` ${result.unit}` : ''}`,
							dash(result.flag),
							day(result.resultedAt),
						]),
			),
			empty: 'No orders.',
		},
		{
			kind: 'table',
			title: 'Prescriptions',
			columns: ['Medicine', 'Sig', 'Quantity', 'Status'],
			rows: encounter.prescriptions.flatMap((prescription) =>
				prescription.items.map((item) => [
					[item.genericName, item.strength].filter(Boolean).join(' '),
					`${item.dose}, ${item.route}, ${item.frequency}${item.durationDays ? ` for ${item.durationDays} days` : ''}`,
					`${item.quantity}${item.quantityUnit ? ` ${item.quantityUnit}` : ''}`,
					prescription.status,
				]),
			),
			empty: 'No prescriptions.',
		},
		{
			kind: 'table',
			title: 'Medical certificates',
			columns: ['Examined', 'Diagnosis', 'Fitness', 'Rest', 'Status'],
			rows: encounter.certificates.map((certificate) => [
				day(certificate.examinedOn),
				certificate.diagnosisText,
				certificate.fitness.replaceAll('_', ' '),
				certificate.restDays ? `${certificate.restDays} day${certificate.restDays === 1 ? '' : 's'}` : '—',
				certificate.status,
			]),
			empty: 'No medical certificate.',
		},
	);
	return sections;
}
