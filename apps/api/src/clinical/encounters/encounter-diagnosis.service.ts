import { DiagnosisDraftSchema, VoidReasonSchema } from '@loopwise/shared/encounter-record';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../audit/audit-changes.js';
import { parseInput } from '../patients/parse-input.js';
import { AlreadyVoidedError } from '../patients/patients.errors.js';
import { ReferenceService } from '../reference/reference.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { AddDiagnosisInput, UpdateDiagnosisInput, VoidEntryInput } from './dto/encounter-record.input.js';
import { EncounterService } from './encounter.service.js';
import { EncounterCardService } from './encounter-card.service.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import type { DiagnosisType } from './encounters.enums.js';
import { type EncounterDiagnosis, toDiagnosis } from './models/encounter-record.model.js';

const AUDITED_FIELDS = ['type', 'isFinal', 'notes', 'sortOrder', 'voidedAt', 'voidedById', 'voidReason'] as const;

/**
 * The diagnoses of an encounter, ICD-10 coded against `icd10_codes` (the list PhilHealth claims use). One PRIMARY
 * per encounter among the entries not voided (a partial unique index enforces it): a new primary demotes the previous
 * one to SECONDARY in the same transaction. A wrong entry is voided with a reason, never deleted.
 */
@Injectable()
export class EncounterDiagnosisService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly records: EncounterRecordRepository,
		private readonly encounterAccess: EncounterService,
		private readonly reference: ReferenceService,
		private readonly cards: EncounterCardService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Adds a diagnosis: PRIMARY by default when the visit has none, else SECONDARY. With `wiseOrigin`: a follow-up of a
	 * confirmed `propose_encounter`, or a `propose_diagnosis` card verified and settled in the same transaction.
	 */
	async add(userId: string, input: AddDiagnosisInput): Promise<EncounterDiagnosis> {
		const { encounterId, wiseOrigin, ...fields } = input;
		const draft = parseInput(DiagnosisDraftSchema, {
			...fields,
			type: fields.type ?? undefined,
			isFinal: fields.isFinal ?? undefined,
		});
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounterAccess.requireWritable(tx, userId, encounterId);
			const { origin, card } = await this.cards.verify(userId, wiseOrigin, encounter, 'addDiagnosis');
			const icd10 = await this.reference.requireIcd10(tx, draft.icd10Code);
			const active = await this.records.listActiveDiagnoses(tx, encounter.id);
			const type: DiagnosisType =
				draft.type ?? (active.some((diagnosis) => diagnosis.type === 'PRIMARY') ? 'SECONDARY' : 'PRIMARY');
			await this.makeRoomForPrimary(tx, encounter.id, type);
			const row = await this.records.createDiagnosis(tx, {
				encounterId: encounter.id,
				icd10Code: icd10.code,
				description: draft.description,
				type,
				isFinal: draft.isFinal,
				sortOrder: active.length,
				notes: draft.notes ?? null,
				recordedById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
			});
			await this.audit.created(tx, {
				event: 'diagnosis.add',
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { after: auditSnapshot(row) },
				origin,
			});
			return toDiagnosis(row);
		});
	}

	/** Changes a diagnosis's type (a new PRIMARY demotes the previous one), finality or notes. */
	async update(userId: string, input: UpdateDiagnosisInput): Promise<EncounterDiagnosis> {
		return this.db.asUser(userId, async (tx) => {
			const current = await this.records.findDiagnosis(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('EncounterDiagnosis', input.id);
			}
			const encounter = await this.encounterAccess.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, input.wiseOrigin, encounter, 'updateDiagnosis');
			if (current.voidedAt) {
				throw new AlreadyVoidedError('diagnosis');
			}
			const data: Prisma.EncounterDiagnosisUncheckedUpdateInput = {};
			if (input.type && input.type !== current.type) {
				await this.makeRoomForPrimary(tx, encounter.id, input.type);
				data.type = input.type;
			}
			if (typeof input.isFinal === 'boolean') {
				data.isFinal = input.isFinal;
			}
			if (input.notes !== undefined) {
				data.notes = input.notes?.trim() || null;
			}
			const row = await this.records.updateDiagnosis(tx, input.id, data);
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
			});
			await this.audit.updated(tx, {
				event: 'diagnosis.update',
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(current, row, AUDITED_FIELDS),
				origin,
			});
			return toDiagnosis(row);
		});
	}

	/** Voids a diagnosis entered in error, with the reason; it stays in the record, struck through. */
	async void(userId: string, input: VoidEntryInput): Promise<EncounterDiagnosis> {
		const voidReason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.records.findDiagnosis(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('EncounterDiagnosis', input.id);
			}
			const encounter = await this.encounterAccess.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, input.wiseOrigin, encounter, 'voidDiagnosis');
			if (current.voidedAt) {
				throw new AlreadyVoidedError('diagnosis');
			}
			const row = await this.records.updateDiagnosis(tx, input.id, {
				voidedAt: new Date(),
				voidedById: userId,
				voidReason,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
			});
			await this.audit.record(tx, {
				action: 'VOID',
				event: 'diagnosis.void',
				entityType: 'EncounterDiagnosis',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(current, row, AUDITED_FIELDS),
				reason: voidReason,
				origin,
			});
			return toDiagnosis(row);
		});
	}

	/** One primary per encounter: a new PRIMARY demotes the current one first. */
	private async makeRoomForPrimary(tx: ClinicalTx, encounterId: string, type: DiagnosisType): Promise<void> {
		if (type === 'PRIMARY') {
			await this.records.demotePrimary(tx, encounterId);
		}
	}
}
