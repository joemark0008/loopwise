import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

const WITH_CLINICS = {
	clinics: {
		where: { isActive: true },
		select: { clinicId: true, roomName: true, clinic: { select: { name: true } } },
	},
} satisfies Prisma.PractitionerInclude;

export type PractitionerRow = Prisma.PractitionerGetPayload<{ include: typeof WITH_CLINICS }>;

/** The clinic as its letterhead prints it. */
export type ClinicLetterheadRow = Prisma.ClinicGetPayload<{
	include: { barangay: true; cityMunicipality: { include: { province: true } } };
}>;

/**
 * Practitioners and the clinics they hold clinic in. Every method takes the caller's transaction
 * (`ClinicalDbService.asUser`): anyone signed in reads credentials, a user writes only their own profile.
 */
@Injectable()
export class PractitionerRepository {
	findByUserId(tx: ClinicalTx, userId: string): Promise<PractitionerRow | null> {
		return tx.practitioner.findUnique({ where: { userId }, include: WITH_CLINICS });
	}

	findById(tx: ClinicalTx, id: string): Promise<PractitionerRow | null> {
		return tx.practitioner.findUnique({ where: { id }, include: WITH_CLINICS });
	}

	findManyByIds(tx: ClinicalTx, ids: readonly string[]): Promise<PractitionerRow[]> {
		return tx.practitioner.findMany({ where: { id: { in: [...ids] } }, include: WITH_CLINICS });
	}

	/** Active practitioners holding clinic at `clinicId`, by name. */
	listAtClinic(tx: ClinicalTx, clinicId: string): Promise<PractitionerRow[]> {
		return tx.practitioner.findMany({
			where: { isActive: true, deletedAt: null, clinics: { some: { clinicId, isActive: true } } },
			include: WITH_CLINICS,
			orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
		});
	}

	create(tx: ClinicalTx, data: Prisma.PractitionerUncheckedCreateInput): Promise<PractitionerRow> {
		return tx.practitioner.create({ data, include: WITH_CLINICS });
	}

	update(tx: ClinicalTx, id: string, data: Prisma.PractitionerUncheckedUpdateInput): Promise<PractitionerRow> {
		return tx.practitioner.update({ where: { id }, data, include: WITH_CLINICS });
	}

	/** Links the practitioner to the clinics not linked yet. */
	async linkClinics(tx: ClinicalTx, practitionerId: string, clinicIds: readonly string[]): Promise<void> {
		if (clinicIds.length === 0) {
			return;
		}
		await tx.practitionerClinic.createMany({
			data: clinicIds.map((clinicId) => ({ practitionerId, clinicId })),
			skipDuplicates: true,
		});
	}

	getUserNames(tx: ClinicalTx, userId: string): Promise<{ firstName: string; lastName: string; email: string }> {
		return tx.user.findUniqueOrThrow({
			where: { id: userId },
			select: { firstName: true, lastName: true, email: true },
		});
	}

	getClinicLetterhead(tx: ClinicalTx, clinicId: string): Promise<ClinicLetterheadRow> {
		return tx.clinic.findUniqueOrThrow({
			where: { id: clinicId },
			include: { barangay: true, cityMunicipality: { include: { province: true } } },
		});
	}
}
