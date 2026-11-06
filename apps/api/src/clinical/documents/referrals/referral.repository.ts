import { Injectable } from '@nestjs/common';

import type { Prisma, ReferralStatus } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { REFERRAL_INCLUDE, type ReferralRow } from './models/referral.model.js';

/**
 * Referrals, reached through their encounter, and the care relationship a referral grants. Reads take the `asUser`
 * transaction; the referral write that also grants access runs on `asSystem`.
 */
@Injectable()
export class ReferralRepository {
	findById(tx: ClinicalTx, id: string): Promise<ReferralRow | null> {
		return tx.referral.findUnique({ where: { id }, include: REFERRAL_INCLUDE });
	}

	listByEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<ReferralRow[]> {
		return tx.referral.findMany({
			where: { encounterId: { in: [...encounterIds] } },
			include: REFERRAL_INCLUDE,
			orderBy: { referredAt: 'desc' },
		});
	}

	create(tx: ClinicalTx, data: Prisma.ReferralUncheckedCreateInput): Promise<ReferralRow> {
		return tx.referral.create({ data, include: REFERRAL_INCLUDE });
	}

	update(tx: ClinicalTx, id: string, data: Prisma.ReferralUncheckedUpdateInput): Promise<ReferralRow> {
		return tx.referral.update({ where: { id }, data, include: REFERRAL_INCLUDE });
	}

	/** Updates the referral only while its status is still `from` (one statement); null when it moved on. */
	async respond(
		tx: ClinicalTx,
		id: string,
		from: ReferralStatus,
		data: Prisma.ReferralUncheckedUpdateManyInput,
	): Promise<ReferralRow | null> {
		const { count } = await tx.referral.updateMany({ where: { id, status: from }, data });
		return count === 0 ? null : tx.referral.findUnique({ where: { id }, include: REFERRAL_INCLUDE });
	}

	/** Referrals to or from a practitioner, or of a clinic's visits, newest first. */
	list(
		tx: ClinicalTx,
		filter: {
			toPractitionerId?: string;
			fromPractitionerId?: string;
			clinicId?: string | null;
			statuses?: readonly ReferralStatus[] | null;
			take: number;
		},
	): Promise<ReferralRow[]> {
		return tx.referral.findMany({
			where: {
				...(filter.toPractitionerId && { toPractitionerId: filter.toPractitionerId }),
				...(filter.fromPractitionerId && { fromPractitionerId: filter.fromPractitionerId }),
				...(filter.clinicId && { encounter: { clinicId: filter.clinicId } }),
				...(filter.statuses?.length && { status: { in: [...filter.statuses] } }),
			},
			include: REFERRAL_INCLUDE,
			orderBy: { referredAt: 'desc' },
			take: filter.take,
		});
	}

	/** Lets the practitioner referred to see the patient (reason REFERRAL), unless they already have open access. */
	async addReferralAccess(
		tx: ClinicalTx,
		access: { patientId: string; userId: string; organizationId: string; note: string },
	): Promise<void> {
		const open = await tx.careRelationship.count({
			where: {
				patientId: access.patientId,
				userId: access.userId,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		});
		if (open === 0) {
			await tx.careRelationship.create({ data: { ...access, reason: 'REFERRAL' } });
		}
	}
}
