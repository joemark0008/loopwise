import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';
import { PATIENT_INCLUDE } from './patient.repository.js';

/** How many of each the chart summary reads. */
const RECENT = 5;

const CHART_INCLUDE = {
	...PATIENT_INCLUDE,
	allergies: {
		where: { voidedAt: null, isActive: true },
		select: { allergen: true, reaction: true },
		orderBy: { notedAt: 'asc' },
	},
	encounters: {
		where: { status: { not: 'CANCELLED' } },
		orderBy: { startedAt: 'desc' },
		take: RECENT,
		select: {
			id: true,
			encounterNo: true,
			type: true,
			status: true,
			startedAt: true,
			chiefComplaint: true,
			historyOfPresentIllness: true,
			physicalExam: true,
			assessment: true,
			plan: true,
			notes: true,
			patientInstructions: true,
			followUpDate: true,
			disposition: true,
			clinic: { select: { name: true } },
		},
	},
} satisfies Prisma.PatientInclude;

export type PatientChartRow = Prisma.PatientGetPayload<{ include: typeof CHART_INCLUDE }>;

export interface ChartDiagnosisRow {
	icd10Code: string | null;
	description: string;
}

export interface ChartVitalsRow {
	recordedAt: Date;
	systolicBp: number | null;
	diastolicBp: number | null;
	weightKg: Prisma.Decimal | null;
	bmi: Prisma.Decimal | null;
}

export interface ChartMedicineRow {
	genericName: string;
	strength: string | null;
	frequency: string | null;
}

export interface ChartResultRow {
	resultId: string;
	resultedAt: Date | null;
	name: string;
	value: string;
	unit: string | null;
	flag: string | null;
}

/**
 * What Wise is told about the patient of a chart chat (`PatientService.getChartSummary`): the patient, allergies and
 * latest visits, and across their encounters the diagnoses, latest vitals, issued medicines and released results.
 * Read as the user (row-level security), each from its own table through the encounter.
 */
@Injectable()
export class PatientChartRepository {
	getChart(tx: ClinicalTx, patientId: string): Promise<PatientChartRow | null> {
		return tx.patient.findFirst({ where: { id: patientId, deletedAt: null }, include: CHART_INCLUDE });
	}

	listDiagnoses(tx: ClinicalTx, patientId: string): Promise<ChartDiagnosisRow[]> {
		return tx.encounterDiagnosis.findMany({
			where: { voidedAt: null, encounter: { patientId, status: { not: 'CANCELLED' } } },
			select: { icd10Code: true, description: true },
			orderBy: { recordedAt: 'desc' },
		});
	}

	latestVitals(tx: ClinicalTx, patientId: string): Promise<ChartVitalsRow | null> {
		return tx.vitalSigns.findFirst({
			where: { voidedAt: null, systolicBp: { not: null }, encounter: { patientId } },
			select: { recordedAt: true, systolicBp: true, diastolicBp: true, weightKg: true, bmi: true },
			orderBy: { recordedAt: 'desc' },
		});
	}

	async listIssuedMedicines(tx: ClinicalTx, patientId: string): Promise<ChartMedicineRow[]> {
		const prescriptions = await tx.prescription.findMany({
			where: { documentStatus: 'ISSUED', voidedAt: null, encounter: { patientId } },
			select: { items: { select: { genericName: true, strength: true, frequency: true } } },
			orderBy: { issuedAt: 'desc' },
			take: RECENT,
		});
		return prescriptions.flatMap((prescription) => prescription.items);
	}

	async listLatestResults(tx: ClinicalTx, patientId: string): Promise<ChartResultRow[]> {
		const values = await tx.diagnosticResultValue.findMany({
			where: {
				result: {
					releasedAt: { not: null },
					orderItem: { order: { encounter: { patientId } } },
				},
			},
			select: {
				name: true,
				value: true,
				unit: true,
				flag: true,
				result: { select: { id: true, resultedAt: true } },
			},
			orderBy: { result: { resultedAt: 'desc' } },
			take: RECENT,
		});
		return values.map((row) => ({
			resultId: row.result.id,
			resultedAt: row.result.resultedAt,
			name: row.name,
			value: row.value,
			unit: row.unit,
			flag: row.flag,
		}));
	}
}
