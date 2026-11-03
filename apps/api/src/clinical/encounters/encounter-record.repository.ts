import { Injectable } from '@nestjs/common';

import type { EncounterDiagnosis, PatientAllergy, Prisma, VitalSigns } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

const RECORD_INCLUDE = {
	vitalSigns: { orderBy: { recordedAt: 'desc' } },
	diagnoses: { orderBy: [{ isPrimary: 'desc' }, { rank: 'asc' }, { createdAt: 'asc' }] },
	orders: { include: { results: true }, orderBy: { createdAt: 'asc' } },
	prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' } },
	certificates: { orderBy: { createdAt: 'desc' } },
	bills: { include: { charges: true }, orderBy: { createdAt: 'desc' } },
} satisfies Prisma.EncounterInclude;

export type EncounterRecordRow = Prisma.EncounterGetPayload<{ include: typeof RECORD_INCLUDE }>;

const VISIT_INCLUDE = {
	vitalSigns: { where: { voidedAt: null }, orderBy: { recordedAt: 'desc' } },
	diagnoses: { where: { voidedAt: null }, orderBy: [{ isPrimary: 'desc' }, { rank: 'asc' }, { createdAt: 'asc' }] },
	orders: { include: { results: true }, orderBy: { createdAt: 'desc' } },
	prescriptions: { where: { status: { not: 'voided' } }, include: { items: true }, orderBy: { createdAt: 'desc' } },
	bills: { where: { status: { not: 'voided' } }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.EncounterInclude;

export type PatientVisitRow = Prisma.EncounterGetPayload<{ include: typeof VISIT_INCLUDE }>;

/**
 * The encounter record: vitals, diagnoses and the patient's allergies, and the whole record in one read. Every method
 * takes the transaction of `ClinicalDbService.asUser`, so row-level security applies.
 */
@Injectable()
export class EncounterRecordRepository {
	/** Null when row-level security hides the encounter. */
	findRecord(tx: Tx, encounterId: string): Promise<EncounterRecordRow | null> {
		return tx.encounter.findUnique({ where: { id: encounterId }, include: RECORD_INCLUDE });
	}

	/** The patient's latest visits with what was recorded in them, newest first (empty when RLS hides the patient). */
	listVisits(tx: Tx, patientId: string, take: number): Promise<PatientVisitRow[]> {
		return tx.encounter.findMany({
			where: { patientId },
			include: VISIT_INCLUDE,
			orderBy: { startedAt: 'desc' },
			take,
		});
	}

	listAllergies(tx: Tx, patientId: string): Promise<PatientAllergy[]> {
		return tx.patientAllergy.findMany({ where: { patientId, voidedAt: null }, orderBy: { createdAt: 'asc' } });
	}

	createVitals(tx: Tx, data: Prisma.VitalSignsUncheckedCreateInput): Promise<VitalSigns> {
		return tx.vitalSigns.create({ data });
	}

	findVitals(tx: Tx, id: string): Promise<VitalSigns | null> {
		return tx.vitalSigns.findUnique({ where: { id } });
	}

	voidVitals(tx: Tx, id: string, voided: { voidedById: string; voidReason: string }): Promise<VitalSigns> {
		return tx.vitalSigns.update({ where: { id }, data: { ...voided, voidedAt: new Date() } });
	}

	findDiagnosis(tx: Tx, id: string): Promise<EncounterDiagnosis | null> {
		return tx.encounterDiagnosis.findUnique({ where: { id } });
	}

	countDiagnoses(tx: Tx, encounterId: string): Promise<number> {
		return tx.encounterDiagnosis.count({ where: { encounterId } });
	}

	/** Clears the current primary, so another diagnosis can take it (one primary per encounter). */
	clearPrimary(tx: Tx, encounterId: string) {
		return tx.encounterDiagnosis.updateMany({
			where: { encounterId, isPrimary: true, voidedAt: null },
			data: { isPrimary: false },
		});
	}

	createDiagnosis(tx: Tx, data: Prisma.EncounterDiagnosisUncheckedCreateInput): Promise<EncounterDiagnosis> {
		return tx.encounterDiagnosis.create({ data });
	}

	updateDiagnosis(
		tx: Tx,
		id: string,
		data: Prisma.EncounterDiagnosisUncheckedUpdateInput,
	): Promise<EncounterDiagnosis> {
		return tx.encounterDiagnosis.update({ where: { id }, data });
	}

	createAllergy(tx: Tx, data: Prisma.PatientAllergyUncheckedCreateInput): Promise<PatientAllergy> {
		return tx.patientAllergy.create({ data });
	}

	findAllergy(tx: Tx, id: string): Promise<PatientAllergy | null> {
		return tx.patientAllergy.findUnique({ where: { id } });
	}

	voidAllergy(tx: Tx, id: string, voided: { voidedById: string; voidReason: string }): Promise<PatientAllergy> {
		return tx.patientAllergy.update({ where: { id }, data: { ...voided, voidedAt: new Date() } });
	}
}
