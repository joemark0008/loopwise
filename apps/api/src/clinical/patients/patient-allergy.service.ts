import { AllergyDraftSchema, VoidReasonSchema } from '@loopwise/shared/encounter-record';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../audit/audit-changes.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import { CareClinicService } from './care-clinic.service.js';
import type { AddAllergyInput, VoidAllergyInput } from './dto/patient-allergy.input.js';
import { type PatientAllergy, toPatientAllergy } from './models/patient-allergy.model.js';
import { parseInput } from './parse-input.js';
import { PatientRepository } from './patient.repository.js';
import { PatientAllergyRepository } from './patient-allergy.repository.js';
import { AlreadyVoidedError } from './patients.errors.js';

/**
 * A patient's allergies (patient master data). Read as the user (row-level security); recorded and voided by staff
 * at a clinic of the patient's organization. A wrong entry is voided, never deleted, and stays struck through. The
 * prescription allergy check (RA 6675: by generic name) reads `listActiveOn`.
 */
@Injectable()
export class PatientAllergyService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly allergies: PatientAllergyRepository,
		private readonly patients: PatientRepository,
		private readonly clinics: CareClinicService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The patient's active allergies; empty when the patient is not in the user's care. */
	list(userId: string, patientId: string): Promise<PatientAllergy[]> {
		return this.db.asUser(userId, (tx) => this.listActiveOn(tx, patientId));
	}

	/** The patient's active allergies on the caller's transaction. */
	async listActiveOn(tx: ClinicalTx, patientId: string): Promise<PatientAllergy[]> {
		return (await this.allergies.listActive(tx, patientId)).map(toPatientAllergy);
	}

	/** Records an allergy; with `wiseOrigin` (a `propose_allergy` card) verified and settled in the same transaction. */
	async add(userId: string, input: AddAllergyInput): Promise<PatientAllergy> {
		const { patientId, wiseOrigin, ...fields } = input;
		const allergy = parseInput(AllergyDraftSchema, {
			...fields,
			type: fields.type ?? undefined,
			severity: fields.severity ?? undefined,
		});
		return this.db.asUser(userId, async (tx) => {
			const patient = await this.patients.findOrganizationId(tx, patientId);
			if (!patient) {
				throw new EntityNotFoundError('Patient', patientId);
			}
			const clinic = await this.clinics.requireInOrganization(userId, patient.organizationId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				wiseOrigin,
				'addAllergy',
				patient.organizationId,
			);
			assertCardPatient(card, patientId);
			const row = await this.allergies.create(tx, {
				patientId,
				allergen: allergy.allergen,
				type: allergy.type,
				reaction: allergy.reaction ?? null,
				severity: allergy.severity ?? null,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'PatientAllergy', entityId: row.id });
			await this.audit.created(tx, {
				event: 'allergy.add',
				entityType: 'PatientAllergy',
				entityId: row.id,
				userId,
				patientId,
				organizationId: patient.organizationId,
				clinicId: clinic.id,
				changes: { after: auditSnapshot(row) },
				origin: card?.origin,
			});
			return toPatientAllergy(row);
		});
	}

	/** Voids an allergy recorded in error, with the reason; it stays in the record. */
	async void(userId: string, input: VoidAllergyInput): Promise<PatientAllergy> {
		const voidReason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.allergies.findById(tx, input.id);
			const patient = current && (await this.patients.findOrganizationId(tx, current.patientId));
			if (!current || !patient) {
				throw new EntityNotFoundError('PatientAllergy', input.id);
			}
			const clinic = await this.clinics.requireInOrganization(userId, patient.organizationId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'voidAllergy',
				patient.organizationId,
			);
			assertCardPatient(card, current.patientId);
			if (current.voidedAt) {
				throw new AlreadyVoidedError('allergy');
			}
			const row = await this.allergies.void(tx, input.id, { voidedById: userId, voidReason });
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'PatientAllergy', entityId: row.id });
			await this.audit.record(tx, {
				action: 'VOID',
				event: 'allergy.void',
				entityType: 'PatientAllergy',
				entityId: row.id,
				userId,
				patientId: row.patientId,
				organizationId: patient.organizationId,
				clinicId: clinic.id,
				changes: auditChanges(current, row, ['voidedAt', 'voidedById', 'voidReason', 'isActive']),
				reason: voidReason,
				origin: card?.origin,
			});
			return toPatientAllergy(row);
		});
	}
}
