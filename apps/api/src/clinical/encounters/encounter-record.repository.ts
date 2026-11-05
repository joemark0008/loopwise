import { Injectable } from '@nestjs/common';

import type { EncounterDiagnosis, Prisma, VitalSigns } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

const DIAGNOSIS_ORDER = [
	{ voidedAt: { sort: 'asc', nulls: 'first' } },
	{ sortOrder: 'asc' },
	{ recordedAt: 'asc' },
] satisfies Prisma.EncounterDiagnosisOrderByWithRelationInput[];

const VISIT_INCLUDE = {
	diagnosis: { where: { voidedAt: null }, orderBy: [{ type: 'asc' }, ...DIAGNOSIS_ORDER] },
} satisfies Prisma.EncounterInclude;

export type PatientVisitRow = Prisma.EncounterGetPayload<{ include: typeof VISIT_INCLUDE }>;

/**
 * The encounter record: vitals and diagnoses (encounter children, reached through the encounter) and the chart's
 * visit list. Every method takes the transaction of `ClinicalDbService.asUser`, so row-level security applies.
 */
@Injectable()
export class EncounterRecordRepository {
	listVitals(tx: ClinicalTx, encounterId: string): Promise<VitalSigns[]> {
		return tx.vitalSigns.findMany({ where: { encounterId }, orderBy: { recordedAt: 'desc' } });
	}

	/** Primary first (the type order), voided last. */
	listDiagnoses(tx: ClinicalTx, encounterId: string): Promise<EncounterDiagnosis[]> {
		return tx.encounterDiagnosis.findMany({
			where: { encounterId },
			orderBy: [{ type: 'asc' }, ...DIAGNOSIS_ORDER],
		});
	}

	/** The patient's latest visits with their diagnoses, newest first (empty when RLS hides the patient). */
	listVisits(tx: ClinicalTx, patientId: string, take: number): Promise<PatientVisitRow[]> {
		return tx.encounter.findMany({
			where: { patientId },
			include: VISIT_INCLUDE,
			orderBy: { startedAt: 'desc' },
			take,
		});
	}

	createVitals(tx: ClinicalTx, data: Prisma.VitalSignsUncheckedCreateInput): Promise<VitalSigns> {
		return tx.vitalSigns.create({ data });
	}

	findVitals(tx: ClinicalTx, id: string): Promise<VitalSigns | null> {
		return tx.vitalSigns.findUnique({ where: { id } });
	}

	voidVitals(tx: ClinicalTx, id: string, voided: { voidedById: string; voidReason: string }): Promise<VitalSigns> {
		return tx.vitalSigns.update({ where: { id }, data: { ...voided, voidedAt: new Date() } });
	}

	findDiagnosis(tx: ClinicalTx, id: string): Promise<EncounterDiagnosis | null> {
		return tx.encounterDiagnosis.findUnique({ where: { id } });
	}

	/** The diagnoses of the encounter that are not voided. */
	listActiveDiagnoses(tx: ClinicalTx, encounterId: string): Promise<EncounterDiagnosis[]> {
		return tx.encounterDiagnosis.findMany({ where: { encounterId, voidedAt: null }, orderBy: DIAGNOSIS_ORDER });
	}

	/** Makes the current primary a secondary diagnosis, so another can take its place (one primary per encounter). */
	demotePrimary(tx: ClinicalTx, encounterId: string): Promise<Prisma.BatchPayload> {
		return tx.encounterDiagnosis.updateMany({
			where: { encounterId, type: 'PRIMARY', voidedAt: null },
			data: { type: 'SECONDARY' },
		});
	}

	createDiagnosis(tx: ClinicalTx, data: Prisma.EncounterDiagnosisUncheckedCreateInput): Promise<EncounterDiagnosis> {
		return tx.encounterDiagnosis.create({ data });
	}

	updateDiagnosis(
		tx: ClinicalTx,
		id: string,
		data: Prisma.EncounterDiagnosisUncheckedUpdateInput,
	): Promise<EncounterDiagnosis> {
		return tx.encounterDiagnosis.update({ where: { id }, data });
	}
}
