import { Injectable } from '@nestjs/common';

import type { MedicalCertificate, Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Medical certificates. Every method takes the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class MedicalCertificateRepository {
	findById(tx: Tx, id: string): Promise<MedicalCertificate | null> {
		return tx.medicalCertificate.findUnique({ where: { id } });
	}

	create(tx: Tx, data: Prisma.MedicalCertificateUncheckedCreateInput): Promise<MedicalCertificate> {
		return tx.medicalCertificate.create({ data });
	}

	update(tx: Tx, id: string, data: Prisma.MedicalCertificateUncheckedUpdateInput): Promise<MedicalCertificate> {
		return tx.medicalCertificate.update({ where: { id }, data });
	}
}
