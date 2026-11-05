import { Injectable } from '@nestjs/common';

import type { PatientAllergy, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** A patient's allergies, on the caller's `asUser` transaction (row-level security through the patient). */
@Injectable()
export class PatientAllergyRepository {
	/** Active allergies not voided, oldest first. */
	listActive(tx: ClinicalTx, patientId: string): Promise<PatientAllergy[]> {
		return tx.patientAllergy.findMany({
			where: { patientId, voidedAt: null, isActive: true },
			orderBy: { notedAt: 'asc' },
		});
	}

	/** Active allergies of several patients (the allergy check of prescriptions, the chart banner). */
	listActiveForPatients(tx: ClinicalTx, patientIds: readonly string[]): Promise<PatientAllergy[]> {
		return tx.patientAllergy.findMany({
			where: { patientId: { in: [...patientIds] }, voidedAt: null, isActive: true },
			orderBy: { notedAt: 'asc' },
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<PatientAllergy | null> {
		return tx.patientAllergy.findUnique({ where: { id } });
	}

	create(tx: ClinicalTx, data: Prisma.PatientAllergyUncheckedCreateInput): Promise<PatientAllergy> {
		return tx.patientAllergy.create({ data });
	}

	void(tx: ClinicalTx, id: string, voided: { voidedById: string; voidReason: string }): Promise<PatientAllergy> {
		return tx.patientAllergy.update({ where: { id }, data: { ...voided, voidedAt: new Date(), isActive: false } });
	}
}
