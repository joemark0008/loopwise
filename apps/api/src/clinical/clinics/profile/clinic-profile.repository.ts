import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

const PROFILE_INCLUDE = {
	organization: true,
	barangay: true,
	cityMunicipality: { include: { province: true } },
} satisfies Prisma.ClinicInclude;

export type ClinicProfileRow = Prisma.ClinicGetPayload<{ include: typeof PROFILE_INCLUDE }>;

/**
 * The organization's and the clinic's registration columns (`organizations`, `clinics`). Signed-in users read them
 * (they print on documents); users have no UPDATE on these tables, so the writes run on a system transaction after
 * the service checked the admin. Every method takes the caller's transaction.
 */
@Injectable()
export class ClinicProfileRepository {
	findProfile(tx: ClinicalTx, clinicId: string): Promise<ClinicProfileRow | null> {
		return tx.clinic.findUnique({ where: { id: clinicId }, include: PROFILE_INCLUDE });
	}

	updateOrganization(tx: ClinicalTx, id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
		return tx.organization.update({ where: { id }, data });
	}

	updateClinic(tx: ClinicalTx, id: string, data: Prisma.ClinicUncheckedUpdateInput): Promise<ClinicProfileRow> {
		return tx.clinic.update({ where: { id }, data, include: PROFILE_INCLUDE });
	}

	/** Another clinic of the organization with this code or (case-insensitive) name. */
	async findConflict(
		tx: ClinicalTx,
		organizationId: string,
		clinicId: string,
		{ code, name }: { code: string; name: string },
	): Promise<{ code: boolean; name: boolean }> {
		const others = await tx.clinic.findMany({
			where: {
				organizationId,
				id: { not: clinicId },
				OR: [{ code }, { name: { equals: name, mode: 'insensitive' } }],
			},
			select: { code: true, name: true },
		});
		return {
			code: others.some((other) => other.code === code),
			name: others.some((other) => other.name.toLowerCase() === name.toLowerCase()),
		};
	}
}
