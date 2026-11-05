import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
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
