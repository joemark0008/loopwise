import { VoidReasonSchema } from '@loopwise/shared/encounter-record';
import { ReferralDraftSchema } from '@loopwise/shared/medical-certificate';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditSnapshot } from '../../audit/audit-changes.js';
import { EncounterService } from '../../encounters/encounter.service.js';
import { parseInput } from '../../patients/parse-input.js';
import { PractitionerService } from '../../practitioners/practitioner.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InvalidDocumentDraftError } from '../documents.errors.js';
import type { CancelReferralInput, CreateReferralInput } from './dto/referral.input.js';
import { type Referral, toReferral } from './models/referral.model.js';
import { ReferralRepository } from './referral.repository.js';
import { transitionReferralStatus } from './referral-status.js';

/**
 * Referrals from an encounter (the base schema's model): from the user's practitioner to a practitioner of the
 * organization (who then gets a care relationship with reason REFERRAL, so they can open the patient) or to an
 * outside doctor or facility. Checked as the user (row-level security, staff of the visit's clinic); the write that
 * also grants access is system work, in one transaction with its audit row.
 */
@Injectable()
export class ReferralService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly referrals: ReferralRepository,
		private readonly encounters: EncounterService,
		private readonly practitioners: PractitionerService,
		private readonly audit: AuditService,
	) {}

	/** The referrals of the encounters (newest first), on the user's transaction. */
	async listForEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Referral[]> {
		return (await this.referrals.listByEncounters(tx, encounterIds)).map(toReferral);
	}

	/** Refers the patient of the visit; one target is required (practitioner here, or outside doctor / facility). */
	async create(userId: string, input: CreateReferralInput): Promise<Referral> {
		const draft = parseInput(
			ReferralDraftSchema,
			Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? undefined])),
			(message) => new InvalidDocumentDraftError(message),
		);
		const { encounter, from, target } = await this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounters.requireWritable(tx, userId, input.encounterId);
			const from = await this.practitioners.requireForUser(tx, userId, 'referral');
			const [target] = draft.toPractitionerId
				? await this.practitioners.findManyByIds(tx, [draft.toPractitionerId])
				: [];
			if (draft.toPractitionerId && !target) {
				throw new EntityNotFoundError('Practitioner', draft.toPractitionerId);
			}
			return { encounter, from, target };
		});

		return this.db.asSystem(async (tx) => {
			const row = await this.referrals.create(tx, {
				encounterId: encounter.id,
				fromPractitionerId: from.id,
				toPractitionerId: target?.id ?? null,
				toExternalDoctor: draft.toExternalDoctor ?? null,
				toFacility: draft.toFacility ?? null,
				specialty: draft.specialty ?? target?.specialty ?? null,
				reason: draft.reason,
				clinicalSummary: draft.clinicalSummary ?? null,
				urgency: draft.urgency,
				status: 'SENT',
			});
			if (target?.userId) {
				await this.referrals.addReferralAccess(tx, {
					patientId: encounter.patientId,
					userId: target.userId,
					organizationId: encounter.organizationId,
					note: `Referral from encounter ${encounter.encounterNo}`,
				});
			}
			await this.audit.created(tx, {
				event: 'referral.create',
				entityType: 'Referral',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { after: auditSnapshot(row) },
			});
			return toReferral(row);
		});
	}

	/** Cancels a referral still on its way (`transitionReferralStatus`), with the reason. */
	async cancel(userId: string, input: CancelReferralInput): Promise<Referral> {
		const reason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.referrals.findById(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('Referral', input.id);
			}
			const encounter = await this.encounters.requireWritable(tx, userId, current.encounterId);
			const status = transitionReferralStatus(current.status, 'CANCELLED');
			const row = await this.referrals.update(tx, current.id, {
				status,
				responseNotes: reason,
				respondedAt: new Date(),
			});
			await this.audit.updated(tx, {
				event: 'referral.cancel',
				entityType: 'Referral',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { before: { status: current.status }, after: { status: row.status } },
				reason,
			});
			return toReferral(row);
		});
	}
}
