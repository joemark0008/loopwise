import { IDENTIFICATION_LABELS } from '@loopwise/shared/patient-registration';

import type { Prisma } from '../../generated/prisma/client.js';
import { toDateOnly } from './parse-input.js';
import type {
	ChartDiagnosisRow,
	ChartMedicineRow,
	ChartResultRow,
	ChartVitalsRow,
	PatientChartRow,
} from './patient-chart.repository.js';

export interface ChartSummaryInput {
	patient: PatientChartRow;
	diagnoses: ChartDiagnosisRow[];
	vitals: ChartVitalsRow | null;
	medicines: ChartMedicineRow[];
	results: ChartResultRow[];
}

/** What Wise is told about the patient of a chart chat, as Markdown lines (no data the user can't see). */
export function renderChartSummary(chart: ChartSummaryInput, today: Date): string {
	const { patient } = chart;
	const [address] = patient.addresses;
	const [consent] = patient.consents;
	const lines = [
		`- Name: ${[patient.firstName, patient.middleName, patient.lastName, patient.suffix].filter(Boolean).join(' ')}`,
		`- Patient no.: ${patient.patientNo}`,
		`- Born ${toDateOnly(patient.birthDate)} (age ${ageOn(patient.birthDate, today)}), sex ${patient.sex}`,
		`- Preferred language: ${patient.preferredLanguage ?? 'not recorded'}; mobile: ${patient.mobileNo ?? 'none on file'}`,
		`- Barangay: ${address?.barangay?.name ?? 'not recorded'}`,
		`- Data-privacy consent: ${consent ? `signed ${toDateOnly(consent.signedAt)}` : 'not on file'}`,
		...patient.identifications.map(
			(identification) =>
				`- ${IDENTIFICATION_LABELS[identification.type] ?? identification.type} ${identification.idNumber}`,
		),
	];
	lines.push(
		patient.allergies.length === 0
			? '- Allergies: none recorded'
			: `- Allergies: ${patient.allergies.map((allergy) => (allergy.reaction ? `${allergy.allergen} (${allergy.reaction})` : allergy.allergen)).join(', ')}`,
	);
	const problems = [...new Map(chart.diagnoses.map((diagnosis) => [diagnosis.icd10Code, diagnosis])).values()];
	lines.push(
		problems.length === 0
			? '- Problems: none recorded'
			: `- Problems (ICD-10): ${problems.map((diagnosis) => `${diagnosis.description} (${diagnosis.icd10Code ?? 'no code'})`).join(', ')}`,
	);
	const medicines = [
		...new Set(
			chart.medicines.map((item) => [item.genericName, item.strength, item.frequency].filter(Boolean).join(' ')),
		),
	];
	lines.push(`- Prescribed (issued): ${medicines.length === 0 ? 'none' : medicines.join('; ')}`);
	if (chart.vitals) {
		const { vitals } = chart;
		const weight = vitals.weightKg === null ? '' : `, weight ${Number(vitals.weightKg)} kg`;
		const bmi = vitals.bmi === null ? '' : `, BMI ${Number(vitals.bmi)}`;
		lines.push(
			`- Latest vitals (${toDateOnly(vitals.recordedAt)}): BP ${vitals.systolicBp}/${vitals.diastolicBp ?? '—'} mmHg${weight}${bmi}`,
		);
	}
	if (chart.results.length > 0) {
		lines.push('- Latest results (newest first):');
		for (const result of chart.results) {
			const flag = result.flag && result.flag !== 'NORMAL' ? ` (${result.flag.toLowerCase()})` : '';
			lines.push(
				`  - ${result.resultedAt ? toDateOnly(result.resultedAt) : 'pending'} [result ${result.resultId}] ${result.name}: ${result.value}${result.unit ? ` ${result.unit}` : ''}${flag}`,
			);
		}
	}
	if (patient.encounters.length === 0) {
		lines.push('- Encounters: none yet');
	} else {
		lines.push(`- Latest encounters (newest first, up to ${patient.encounters.length}):`);
		for (const encounter of patient.encounters) {
			const text = encounter.assessment ?? encounter.notes;
			const notes = text ? ` — ${truncate(text.replace(/\s+/g, ' '), 300)}` : '';
			lines.push(
				`  - ${toDateOnly(encounter.startedAt)} [encounter ${encounter.id}] ${encounter.encounterNo}, ${encounter.type}, ${encounter.status} at ${encounter.clinic.name}: ${encounter.chiefComplaint ?? 'no chief complaint'}${notes}`,
			);
			// The rest of the SOAP note as it is (the assessment heads the line), so Wise can draft a change to it
			// (`propose_encounter_note`) without asking.
			for (const [label, value] of [
				['History', encounter.historyOfPresentIllness],
				['Exam', physicalExamText(encounter.physicalExam)],
				['Plan', encounter.plan],
				['Instructions', encounter.patientInstructions],
				['Follow-up on', toDateOnly(encounter.followUpDate)],
				['Disposition', encounter.disposition],
			] as const) {
				if (value) {
					lines.push(`    - ${label}: ${truncate(value.replace(/\s+/g, ' '), 500)}`);
				}
			}
		}
	}
	return lines.join('\n');
}

/**
 * The physical exam as text. Loopwise stores the free text as a JSON string value; the reference's structured form
 * (`{ "heent": "…", "chest": "…" }`) reads as `heent: …; chest: …`.
 */
export function physicalExamText(value: Prisma.JsonValue | null): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	if (typeof value === 'string') {
		return value || null;
	}
	if (typeof value === 'object' && !Array.isArray(value)) {
		const parts = Object.entries(value)
			.filter(([, text]) => typeof text === 'string' && text.trim())
			.map(([system, text]) => `${system}: ${String(text)}`);
		return parts.length > 0 ? parts.join('; ') : null;
	}
	return String(value);
}

export function ageOn(birthDate: Date, today: Date): number {
	const hadBirthday =
		today.getUTCMonth() > birthDate.getUTCMonth() ||
		(today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() >= birthDate.getUTCDate());
	return today.getUTCFullYear() - birthDate.getUTCFullYear() - (hadBirthday ? 0 : 1);
}

const truncate = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);
