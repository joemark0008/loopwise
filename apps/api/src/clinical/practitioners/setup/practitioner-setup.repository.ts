import { Injectable } from '@nestjs/common';

import type { PractitionerClinic, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

const WITH_PRACTITIONER = {
	practitioner: {
		include: {
			clinics: {
				where: { isActive: true },
				select: { clinicId: true, roomName: true, clinic: { select: { name: true } } },
			},
		},
	},
} satisfies Prisma.PractitionerClinicInclude;

export type ClinicPractitionerRow = Prisma.PractitionerClinicGetPayload<{ include: typeof WITH_PRACTITIONER }>;

/**
 * The clinic side of practitioners (`practitioner_clinics`) and the users who could sign in as one. Every method
 * takes the caller's transaction; `practitioner_clinics` rows are the clinic staff's (row-level security).
 */
@Injectable()
export class PractitionerSetupRepository {
	/** Every practitioner linked to the clinic, active or not, by name. */
	listAtClinic(tx: ClinicalTx, clinicId: string): Promise<ClinicPractitionerRow[]> {
		return tx.practitionerClinic.findMany({
			where: { clinicId, practitioner: { deletedAt: null } },
			include: WITH_PRACTITIONER,
			orderBy: [{ practitioner: { lastName: 'asc' } }, { practitioner: { firstName: 'asc' } }],
		});
	}

	findLink(tx: ClinicalTx, practitionerId: string, clinicId: string): Promise<ClinicPractitionerRow | null> {
		return tx.practitionerClinic.findUnique({
			where: { practitionerId_clinicId: { practitionerId, clinicId } },
			include: WITH_PRACTITIONER,
		});
	}

	upsertLink(
		tx: ClinicalTx,
		practitionerId: string,
		clinicId: string,
		data: { roomName?: string | null; consultFee?: number | null; isActive?: boolean },
	): Promise<PractitionerClinic> {
		return tx.practitionerClinic.upsert({
			where: { practitionerId_clinicId: { practitionerId, clinicId } },
			create: { practitionerId, clinicId, ...data },
			update: data,
		});
	}

	/** Users with a role at the clinic who have no practitioner profile yet, by name. */
	listUsersWithoutProfile(
		tx: ClinicalTx,
		clinicId: string,
	): Promise<{ id: string; name: string; email: string; firstName: string; lastName: string }[]> {
		return tx.user.findMany({
			where: { isActive: true, practitioner: null, clinicRoles: { some: { clinicId } } },
			select: { id: true, name: true, email: true, firstName: true, lastName: true },
			orderBy: { name: 'asc' },
		});
	}

	/** Whether the user holds a role at the clinic, and their practitioner id if they have a profile. */
	async userAtClinic(
		tx: ClinicalTx,
		userId: string,
		clinicId: string,
	): Promise<{ atClinic: boolean; practitionerId: string | null } | null> {
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: {
				clinicRoles: { where: { clinicId }, select: { role: true }, take: 1 },
				practitioner: { select: { id: true } },
			},
		});
		return user && { atClinic: user.clinicRoles.length > 0, practitionerId: user.practitioner?.id ?? null };
	}
}
