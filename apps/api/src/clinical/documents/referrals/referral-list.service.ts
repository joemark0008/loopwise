import { Injectable } from '@nestjs/common';

import { AccessService } from '../../../common/guards/access.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { EncounterService } from '../../encounters/encounter.service.js';
import { InvalidInputError } from '../../patients/patients.errors.js';
import { PractitionerService } from '../../practitioners/practitioner.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { ClinicReferralsAccessError } from '../documents.errors.js';
import type { ReferralsInput } from './dto/referral.input.js';
import { type Referral, type ReferralLetter, toReferral } from './models/referral.model.js';
import { ReferralRepository } from './referral.repository.js';

/** The most referrals one list returns. */
const LIST_LIMIT = 200;

/**
 * The referral lists and the printed letter. A doctor's inbox (sent to their practitioner, internal referrals) and
 * outbox (sent by them, internal and external) are read as the user, under row-level security. A clinic's every
 * referral is for its admins: read as system work after the admin check, filtered to the clinic, and audited as a
 * view. The letter is read as the user and audited as a print.
 */
@Injectable()
export class ReferralListService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly referrals: ReferralRepository,
		private readonly encounters: EncounterService,
		private readonly practitioners: PractitionerService,
		private readonly access: AccessService,
		private readonly audit: AuditService,
	) {}

	async list(userId: string, input: ReferralsInput): Promise<Referral[]> {
		if (input.box === 'CLINIC') {
			return this.listClinic(userId, input);
		}
		return this.db.asUser(userId, async (tx) => {
			const mine = await this.practitioners.findIdForUser(tx, userId);
			if (!mine) {
				// No practitioner profile: no referrals of one's own.
				return [];
			}
			const rows = await this.referrals.list(tx, {
				...(input.box === 'INBOX' ? { toPractitionerId: mine } : { fromPractitionerId: mine }),
				clinicId: input.clinicId,
				statuses: input.statuses,
				take: LIST_LIMIT,
			});
			return rows.map(toReferral);
		});
	}

	/** The referral as printed: the referral and the referring doctor on the visit's clinic letterhead. */
	letter(userId: string, id: string): Promise<ReferralLetter | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.referrals.findById(tx, id);
			const encounter = row && (await this.encounters.findReadable(tx, row.encounterId));
			if (!row || !encounter) {
				return null;
			}
			const signatory = await this.practitioners.signatory(tx, row.fromPractitionerId, encounter.clinicId);
			await this.audit.record(tx, {
				action: 'PRINT',
				event: 'referral.print',
				entityType: 'Referral',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
			});
			return { referral: toReferral(row), signatory };
		});
	}

	private async listClinic(userId: string, input: ReferralsInput): Promise<Referral[]> {
		if (!input.clinicId) {
			throw new InvalidInputError('Name the clinic whose referrals to list.');
		}
		const clinicId = input.clinicId;
		if ((await this.access.getUserRoleInClinic(clinicId, userId)) !== 'admin') {
			throw new ClinicReferralsAccessError();
		}
		return this.db.asSystem(async (tx) => {
			const rows = await this.referrals.list(tx, {
				clinicId,
				statuses: input.statuses,
				take: LIST_LIMIT,
			});
			await this.audit.view(tx, {
				event: 'referral.list',
				entityType: 'Referral',
				userId,
				clinicId,
				reason: 'Clinic referrals (admin)',
			});
			return rows.map(toReferral);
		});
	}
}
