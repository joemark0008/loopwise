import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { CERTIFICATE_INCLUDE, type MedicalCertificateRow } from './models/medical-certificate.model.js';

/** Medical certificates, reached through their encounter. Every method takes the `asUser` transaction. */
@Injectable()
export class MedicalCertificateRepository {
	findById(tx: ClinicalTx, id: string): Promise<MedicalCertificateRow | null> {
		return tx.medicalCertificate.findUnique({ where: { id }, include: CERTIFICATE_INCLUDE });
	}

	listByEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<MedicalCertificateRow[]> {
		return tx.medicalCertificate.findMany({
			where: { encounterId: { in: [...encounterIds] } },
			include: CERTIFICATE_INCLUDE,
			orderBy: { createdAt: 'desc' },
		});
	}

	create(tx: ClinicalTx, data: Prisma.MedicalCertificateUncheckedCreateInput): Promise<MedicalCertificateRow> {
		return tx.medicalCertificate.create({ data, include: CERTIFICATE_INCLUDE });
	}

	/** With `expectedVersion`, only while the version is still that one (null when it moved on). */
	async updateDraft(
		tx: ClinicalTx,
		id: string,
		data: Prisma.MedicalCertificateUncheckedUpdateManyInput,
		expectedVersion?: number | null,
	): Promise<MedicalCertificateRow | null> {
		const { count } = await tx.medicalCertificate.updateMany({
			where: { id, ...(expectedVersion != null && { version: expectedVersion }) },
			data,
		});
		return count === 0 ? null : this.findById(tx, id);
	}

	update(
		tx: ClinicalTx,
		id: string,
		data: Prisma.MedicalCertificateUncheckedUpdateInput,
	): Promise<MedicalCertificateRow> {
		return tx.medicalCertificate.update({ where: { id }, data, include: CERTIFICATE_INCLUDE });
	}
}
