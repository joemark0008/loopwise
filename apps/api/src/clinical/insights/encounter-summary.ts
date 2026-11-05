import type { createReport } from '@loopwise/shared/tools';

import { physicalExamText } from '../patients/patient-chart-summary.js';
import { practitionerDisplayName } from '../practitioners/models/practitioner.model.js';
import type { EncounterRecordRow } from './insights.repository.js';
import { ageOn } from './patient-summary.js';

type Section = createReport.Section;

const day = (date: Date) => date.toISOString().slice(0, 10);
const dash = (value: string | number | null | undefined) =>
	value === null || value === undefined || value === '' ? '—' : String(value);
const num = (value: { toString(): string } | null) => (value === null ? null : Number(value));

/** The data sections of one visit's summary: who, when and where, the note, then what was recorded and ordered. */
export function buildEncounterSummarySections(encounter: EncounterRecordRow, today: Date): Section[] {
	const { patient } = encounter;
	const sections: Section[] = [
		{
			kind: 'facts',
			title: 'Visit',
			facts: [
				{ label: 'Patient', value: `${patient.firstName} ${patient.lastName}` },
				{ label: 'Age, sex', value: `${ageOn(patient.birthDate, today)}, ${patient.sex}` },
				{ label: 'Patient no.', value: patient.patientNo },
				{ label: 'Visit no.', value: encounter.encounterNo },
				{ label: 'Type', value: encounter.type },
				{ label: 'Status', value: encounter.status },
				{ label: 'Date', value: day(encounter.startedAt) },
				{ label: 'Clinic', value: encounter.clinic.name },
				{
					label: 'Doctor',
					value: encounter.practitioner ? practitionerDisplayName(encounter.practitioner) : '—',
				},
				{ label: 'Chief complaint', value: dash(encounter.chiefComplaint) },
				{ label: 'Follow-up', value: encounter.followUpDate ? day(encounter.followUpDate) : 'none set' },
				{ label: 'Disposition', value: dash(encounter.disposition) },
				{
					label: 'Allergies',
					value:
						patient.allergies.length === 0
							? 'none recorded'
							: patient.allergies.map((allergy) => allergy.allergen).join(', '),
				},
			],
		},
	];
	for (const [title, text] of [
		['History of present illness', encounter.historyOfPresentIllness],
		['Physical examination', physicalExamText(encounter.physicalExam)],
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
			rows: encounter.vitals.map((vitals) => [
				vitals.recordedAt.toISOString().slice(11, 16),
				vitals.systolicBp === null ? '—' : `${vitals.systolicBp}/${dash(vitals.diastolicBp)}`,
				dash(vitals.heartRate),
				dash(vitals.respiratoryRate),
				dash(num(vitals.temperatureC)),
				vitals.oxygenSaturation === null ? '—' : `${vitals.oxygenSaturation}%`,
				dash(num(vitals.weightKg)),
				dash(num(vitals.bmi)),
				dash(num(vitals.bloodGlucose)),
			]),
			empty: 'No vital signs recorded at this visit.',
		},
		{
			kind: 'table',
			title: 'Diagnoses',
			columns: ['ICD-10', 'Diagnosis', 'Type', 'Final'],
			rows: encounter.diagnosis.map((diagnosis) => [
				dash(diagnosis.icd10Code),
				diagnosis.description,
				diagnosis.type,
				diagnosis.isFinal ? 'yes' : 'no',
			]),
			empty: 'No diagnoses recorded.',
		},
		{
			kind: 'table',
			title: 'Orders and results',
			columns: ['Test', 'Status', 'Result', 'Flag', 'Resulted'],
			rows: encounter.diagnosticOrders.flatMap((order) =>
				order.items.flatMap((item) => {
					const values = item.result?.values ?? [];
					return values.length === 0
						? [[item.test.name, item.status, '—', '—', '—']]
						: values.map((value) => [
								values.length > 1 ? `${item.test.name}: ${value.name}` : item.test.name,
								item.status,
								`${value.value}${value.unit ? ` ${value.unit}` : ''}`,
								dash(value.flag),
								item.result?.resultedAt ? day(item.result.resultedAt) : '—',
							]);
				}),
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
					item.sig,
					`${Number(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`,
					prescription.documentStatus,
				]),
			),
			empty: 'No prescriptions.',
		},
		{
			kind: 'table',
			title: 'Medical certificates',
			columns: ['Examined', 'Diagnosis', 'Fit to work', 'Rest', 'Status'],
			rows: encounter.medicalCertificates.map((certificate) => [
				day(certificate.examinedAt),
				dash(certificate.diagnosisText),
				certificate.isFitToWork === null ? '—' : certificate.isFitToWork ? 'yes' : 'no',
				certificate.restDays ? `${certificate.restDays} day${certificate.restDays === 1 ? '' : 's'}` : '—',
				certificate.documentStatus,
			]),
			empty: 'No medical certificate.',
		},
	);
	return sections;
}
