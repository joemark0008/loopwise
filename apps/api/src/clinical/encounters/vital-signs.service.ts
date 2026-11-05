import { VoidReasonSchema } from '@loopwise/shared/encounter-record';
import { computeBmi, VitalsDraftSchema } from '@loopwise/shared/vitals';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../audit/audit-changes.js';
import { parseInput } from '../patients/parse-input.js';
import { AlreadyVoidedError } from '../patients/patients.errors.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { RecordVitalsInput, VoidEntryInput } from './dto/encounter-record.input.js';
import { EncounterService } from './encounter.service.js';
import { EncounterCardService } from './encounter-card.service.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import { toVitalSigns, type VitalSigns } from './models/encounter-record.model.js';

/**
 * Vital signs of an encounter (triage, the doctor's re-check). Recorded as the user by staff of the visit's clinic;
 * the BMI is computed from weight and height. A wrong reading is voided with a reason, never deleted.
 */
@Injectable()
export class VitalSignsService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly records: EncounterRecordRepository,
		private readonly encounterAccess: EncounterService,
		private readonly cards: EncounterCardService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Records a set of vitals. With `wiseOrigin`: the vitals a confirmed `propose_encounter` drafted (a follow-up of
	 * that card), or a `propose_vitals` card, verified and settled in the same transaction.
	 */
	async record(userId: string, input: RecordVitalsInput): Promise<VitalSigns> {
		const { encounterId, wiseOrigin, ...fields } = input;
		const vitals = parseInput(VitalsDraftSchema, fields);
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounterAccess.requireWritable(tx, userId, encounterId);
			const { origin, card } = await this.cards.verify(userId, wiseOrigin, encounter, 'recordVitals');
			const row = await this.records.createVitals(tx, {
				encounterId: encounter.id,
				recordedById: userId,
				systolicBp: vitals.systolicMmHg ?? null,
				diastolicBp: vitals.diastolicMmHg ?? null,
				heartRate: vitals.heartRateBpm ?? null,
				respiratoryRate: vitals.respiratoryRate ?? null,
				temperatureC: vitals.temperatureC ?? null,
				oxygenSaturation: vitals.spo2Pct ?? null,
				weightKg: vitals.weightKg ?? null,
				heightCm: vitals.heightCm ?? null,
				bmi: computeBmi(vitals.weightKg, vitals.heightCm) ?? null,
				bloodGlucose: vitals.bloodGlucoseMgDl ?? null,
				painScore: vitals.painScore ?? null,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'VitalSigns', entityId: row.id });
			await this.audit.created(tx, {
				event: 'vitals.record',
				entityType: 'VitalSigns',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { after: auditSnapshot(row) },
				origin,
			});
			return toVitalSigns(row);
		});
	}

	/** Voids a set of vitals entered in error, with the reason; it stays in the record, struck through. */
	async void(userId: string, input: VoidEntryInput): Promise<VitalSigns> {
		const voidReason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.records.findVitals(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('VitalSigns', input.id);
			}
			const encounter = await this.encounterAccess.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, input.wiseOrigin, encounter, 'voidVitals');
			if (current.voidedAt) {
				throw new AlreadyVoidedError('set of vitals');
			}
			const row = await this.records.voidVitals(tx, input.id, { voidedById: userId, voidReason });
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'VitalSigns', entityId: row.id });
			await this.audit.record(tx, {
				action: 'VOID',
				event: 'vitals.void',
				entityType: 'VitalSigns',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(current, row, ['voidedAt', 'voidedById', 'voidReason']),
				reason: voidReason,
				origin,
			});
			return toVitalSigns(row);
		});
	}
}
