import { Injectable } from '@nestjs/common';

import type { ClinicianProfile, Prisma } from '../../generated/prisma/client.js';
import type { DocumentSignatory } from '../prescriptions/models/prescription.model.js';

type Tx = Prisma.TransactionClient;

/** Clinician profiles (PRC license, PTR). Every method takes the transaction of `ClinicalDbService.asUser`. */
@Injectable()
export class ClinicianRepository {
	getProfile(tx: Tx, userId: string): Promise<ClinicianProfile | null> {
		return tx.clinicianProfile.findUnique({ where: { userId } });
	}

	upsertProfile(
		tx: Tx,
		userId: string,
		data: Omit<Prisma.ClinicianProfileUncheckedCreateInput, 'userId'>,
	): Promise<ClinicianProfile> {
		return tx.clinicianProfile.upsert({ where: { userId }, create: { ...data, userId }, update: data });
	}

	/** Who signs a document today: the clinician's name and credentials and the facility's letterhead. */
	async getSignatory(tx: Tx, userId: string, orgId: string): Promise<DocumentSignatory> {
		// One after the other: a transaction's queries share one connection.
		const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
		const profile = await this.getProfile(tx, userId);
		const facility = await tx.organization.findUniqueOrThrow({
			where: { id: orgId },
			select: { name: true, address: true, phone: true },
		});
		return {
			name: user.name,
			credentials: profile?.credentials ?? null,
			licenseNumber: profile?.prcLicenseNumber ?? null,
			ptrNumber: profile?.ptrNumber ?? null,
			facilityName: facility.name,
			facilityAddress: facility.address,
			facilityPhone: facility.phone,
		};
	}
}
