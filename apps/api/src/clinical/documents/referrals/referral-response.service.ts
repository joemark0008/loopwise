import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { ReferralStatus } from '../../../generated/prisma/enums.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { type EncounterContext, EncounterService } from '../../encounters/encounter.service.js';
import { PractitionerService } from '../../practitioners/practitioner.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { NotReferralRecipientError, ReferralMovedError, ReferralResponseRequiredError } from '../documents.errors.js';
import type { AcceptReferralInput, CompleteReferralInput, DeclineReferralInput } from './dto/referral.input.js';
import { type Referral, type ReferralRow, toReferral } from './models/referral.model.js';
import { ReferralRepository } from './referral.repository.js';
import { transitionReferralStatus } from './referral-status.js';

/** The response moves, each one transition of `transitionReferralStatus`. */
type ResponseMove = 'ACCEPTED' | 'DECLINED' | 'COMPLETED';

const EVENTS: Record<ResponseMove, string> = {
	ACCEPTED: 'referral.accept',
	DECLINED: 'referral.decline',
	COMPLETED: 'referral.complete',
};

/**
 * The answer to a referral (DESIGN.md §6): SENT → ACCEPTED (with an optional note) or DECLINED (with the reason), then
 * ACCEPTED → COMPLETED (with the response notes). Each stamps `responded_at` and writes `response_notes`.
 *
 * Who answers: an internal referral (to a practitioner of the organization) is answered by that practitioner, who
 * reaches the patient through the REFERRAL care relationship the referral gave them; an external one (to an outside
 * doctor or facility) is marked by the referring side, staff of the referring visit's clinic. The check runs as the
 * user (row-level security); the write is system work in one transaction with its audit row, so a receiving doctor
 * whose clinic differs from the referring visit's can still answer. Two answers at once: the second gets
 * REFERRAL_MOVED.
 */
@Injectable()
export class ReferralResponseService {
	private readonly logger = new Logger(ReferralResponseService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly referrals: ReferralRepository,
		private readonly encounters: EncounterService,
		private readonly practitioners: PractitionerService,
		private readonly audit: AuditService,
	) {}

	accept(userId: string, input: AcceptReferralInput): Promise<Referral> {
		return this.respond(userId, input.id, 'ACCEPTED', input.notes?.trim() || null);
	}

	decline(userId: string, input: DeclineReferralInput): Promise<Referral> {
		const reason = input.reason.trim();
		if (!reason) {
			throw new ReferralResponseRequiredError('reason');
		}
		return this.respond(userId, input.id, 'DECLINED', reason);
	}

	complete(userId: string, input: CompleteReferralInput): Promise<Referral> {
		const notes = input.responseNotes.trim();
		if (!notes) {
			throw new ReferralResponseRequiredError('notes');
		}
		return this.respond(userId, input.id, 'COMPLETED', notes);
	}

	private async respond(userId: string, id: string, to: ResponseMove, notes: string | null): Promise<Referral> {
		const { current, encounter } = await this.requireAnswerable(userId, id);
		const status = transitionReferralStatus(current.status, to);
		return this.db.asSystem(async (tx) => {
			const row = await this.referrals.respond(tx, current.id, current.status, {
				status,
				// Accepting without a note keeps nothing; the audit row keeps every earlier answer.
				responseNotes: notes ?? current.responseNotes,
				respondedAt: new Date(),
			});
			if (!row) {
				throw new ReferralMovedError();
			}
			await this.audit.updated(tx, {
				event: EVENTS[to],
				entityType: 'Referral',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(snapshot(current), snapshot(row)),
				reason: to === 'DECLINED' ? notes : null,
			});
			this.logger.log(`Referral ${row.id} ${current.status} → ${row.status}`);
			return toReferral(row);
		});
	}

	/** The referral and its visit, when the user may answer it: its recipient (internal) or the referring clinic. */
	private async requireAnswerable(
		userId: string,
		id: string,
	): Promise<{ current: ReferralRow; encounter: EncounterContext }> {
		return this.db.asUser(userId, async (tx) => {
			const current = await this.referrals.findById(tx, id);
			if (!current) {
				throw new EntityNotFoundError('Referral', id);
			}
			if (current.toPractitionerId) {
				const mine = await this.practitioners.findIdForUser(tx, userId);
				const encounter = await this.encounters.findReadable(tx, current.encounterId);
				if (mine !== current.toPractitionerId || !encounter) {
					throw new NotReferralRecipientError();
				}
				return { current, encounter };
			}
			return { current, encounter: await this.encounters.requireWritable(tx, userId, current.encounterId) };
		});
	}
}

function snapshot(row: { status: ReferralStatus; responseNotes: string | null; respondedAt: Date | null }) {
	return { status: row.status, responseNotes: row.responseNotes, respondedAt: row.respondedAt };
}
