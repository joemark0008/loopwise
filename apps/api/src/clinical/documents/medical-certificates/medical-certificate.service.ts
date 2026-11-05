import { VoidReasonSchema } from '@loopwise/shared/encounter-record';
import {
	type MedicalCertificateDraft,
	MedicalCertificateDraftSchema,
	restUntil,
} from '@loopwise/shared/medical-certificate';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, StaleVersionError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import type { VoidEntryInput } from '../../encounters/dto/encounter-record.input.js';
import { EncounterService } from '../../encounters/encounter.service.js';
import { EncounterCardService } from '../../encounters/encounter-card.service.js';
import { dateOnly, parseInput } from '../../patients/parse-input.js';
import { parseSignatory, signatoryJson } from '../../practitioners/models/document-signatory.model.js';
import { PractitionerService } from '../../practitioners/practitioner.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import { assertEditableDraft, assertVoidable, issueDocument, newVerificationCode } from '../document-lifecycle.js';
import { DocumentEncounterMismatchError, InvalidDocumentDraftError } from '../documents.errors.js';
import type { SaveMedicalCertificateInput } from './dto/medical-certificate.input.js';
import { MedicalCertificateRepository } from './medical-certificate.repository.js';
import {
	type MedicalCertificate,
	type MedicalCertificateRow,
	toMedicalCertificate,
} from './models/medical-certificate.model.js';

const LABEL = 'medical certificate';

/**
 * Medical certificates (DESIGN.md §5), like prescriptions: a draft gets its certificate number (DocumentSequence
 * `MED_CERT`) and verification code (printed as a QR to deter fake certificates) when created, and is replaced
 * freely; issuing signs it as the issuing practitioner (PRC license on the letterhead), freezes the signatory and
 * locks the row (a trigger allows only voiding: `is_void` with who, when and why). Every view and change is audited.
 */
@Injectable()
export class MedicalCertificateService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly certificates: MedicalCertificateRepository,
		private readonly encounters: EncounterService,
		private readonly cards: EncounterCardService,
		private readonly practitioners: PractitionerService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** For the print view, with the signatory (the issue-time snapshot, or today's for a draft); audited as PRINT. */
	getForPrint(userId: string, id: string): Promise<MedicalCertificate | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.certificates.findById(tx, id);
			if (!row) {
				return null;
			}
			const encounter = await this.encounters.findReadable(tx, row.encounterId);
			const signatory =
				row.documentStatus === 'ISSUED'
					? parseSignatory(row.signatory)
					: await this.practitioners.signatory(tx, row.practitionerId, row.encounter.clinicId);
			await this.audit.record(tx, {
				action: 'PRINT',
				event: 'medical_certificate.print',
				entityType: 'MedicalCertificate',
				entityId: row.id,
				userId,
				patientId: row.encounter.patientId,
				organizationId: encounter?.organizationId,
				clinicId: row.encounter.clinicId,
			});
			return toMedicalCertificate(row, signatory);
		});
	}

	/** The certificates of the encounters (newest first), on the user's transaction. */
	async listForEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<MedicalCertificate[]> {
		return (await this.certificates.listByEncounters(tx, encounterIds)).map((row) => toMedicalCertificate(row));
	}

	/**
	 * Creates a draft (number and verification code assigned now), or replaces the draft `id` (refused once issued, or
	 * STALE_VERSION when it changed since `expectedVersion`). With `wiseOrigin` (a `propose_medical_certificate`
	 * card) verified and settled in the same transaction.
	 */
	async save(userId: string, input: SaveMedicalCertificateInput): Promise<MedicalCertificate> {
		const draft = parseDraft(input);
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounters.requireWritable(tx, userId, input.encounterId);
			const card = input.wiseOrigin
				? await this.wiseProposals.verify(userId, input.wiseOrigin, {
						toolNames: ['propose_medical_certificate'],
						organizationId: encounter.organizationId,
					})
				: undefined;
			assertCardPatient(card, encounter.patientId);
			const practitioner = await this.practitioners.requireForUser(tx, userId, LABEL);
			const fields = { ...toFields(draft), practitionerId: practitioner.id };
			let before: MedicalCertificateRow | null = null;
			let row: MedicalCertificateRow;
			if (input.id) {
				before = await this.certificates.findById(tx, input.id);
				if (!before) {
					throw new EntityNotFoundError('MedicalCertificate', input.id);
				}
				if (before.encounterId !== encounter.id) {
					throw new DocumentEncounterMismatchError();
				}
				assertEditableDraft(state(before), LABEL, before.certNo);
				const updated = await this.certificates.updateDraft(tx, before.id, fields, input.expectedVersion);
				if (!updated) {
					throw new StaleVersionError(
						'MedicalCertificate',
						input.expectedVersion ?? before.version,
						before.version,
					);
				}
				row = updated;
			} else {
				row = await this.certificates.create(tx, {
					...fields,
					encounterId: encounter.id,
					certNo: await this.sequences.next(
						tx,
						{ id: encounter.clinicId, code: encounter.clinicCode },
						'MED_CERT',
					),
					verificationCode: newVerificationCode(),
				});
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, {
					entityType: 'MedicalCertificate',
					entityId: row.id,
				});
			}
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: 'medical_certificate.save',
				entityType: 'MedicalCertificate',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: before
					? auditChanges(snapshot(before), snapshot(row))
					: { after: auditSnapshot(snapshot(row)) },
				origin: card?.origin,
			});
			return toMedicalCertificate(row);
		});
	}

	/** Issues (signs) the draft as the signed-in practitioner; frozen signatory, locked from then on. */
	async issue(userId: string, id: string, wiseOrigin?: WiseOriginInput | null): Promise<MedicalCertificate> {
		return this.db.asUser(userId, async (tx) => {
			const current = await this.certificates.findById(tx, id);
			if (!current) {
				throw new EntityNotFoundError('MedicalCertificate', id);
			}
			const encounter = await this.encounters.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, wiseOrigin, encounter, 'issueMedicalCertificate');
			const change = issueDocument(state(current), LABEL, current.certNo);
			const practitioner = await this.practitioners.requireForUser(tx, userId, LABEL);
			const signatory = await this.practitioners.signatory(tx, practitioner.id, encounter.clinicId);
			const row = await this.certificates.update(tx, id, {
				...change,
				practitionerId: practitioner.id,
				signatory: signatoryJson(signatory),
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'MedicalCertificate',
				entityId: row.id,
			});
			await this.audit.record(tx, {
				action: 'SIGN',
				event: 'medical_certificate.issue',
				entityType: 'MedicalCertificate',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: {
					before: { documentStatus: 'DRAFT' },
					after: { documentStatus: 'ISSUED', certNo: row.certNo },
				},
				origin,
			});
			return toMedicalCertificate(row, signatory);
		});
	}

	/** Voids the certificate (draft or issued) with the reason; it stays in the record, marked void. */
	async void(userId: string, input: VoidEntryInput): Promise<MedicalCertificate> {
		const voidReason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.certificates.findById(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('MedicalCertificate', input.id);
			}
			const encounter = await this.encounters.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(
				userId,
				input.wiseOrigin,
				encounter,
				'voidMedicalCertificate',
			);
			assertVoidable(state(current), LABEL, current.certNo);
			const row = await this.certificates.update(tx, input.id, {
				isVoid: true,
				voidReason,
				voidedAt: new Date(),
				voidedById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'MedicalCertificate',
				entityId: row.id,
			});
			await this.audit.record(tx, {
				action: 'VOID',
				event: 'medical_certificate.void',
				entityType: 'MedicalCertificate',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { before: { isVoid: false }, after: { isVoid: true } },
				reason: voidReason,
				origin,
			});
			return toMedicalCertificate(row);
		});
	}
}

function parseDraft(input: SaveMedicalCertificateInput): MedicalCertificateDraft {
	return parseInput(
		MedicalCertificateDraftSchema,
		{
			type: input.type ?? undefined,
			examinedOn: input.examinedOn,
			diagnosisText: input.diagnosisText,
			findings: input.findings ?? undefined,
			recommendation: input.recommendation ?? undefined,
			isFitToWork: input.isFitToWork ?? undefined,
			restFrom: input.restFrom ?? undefined,
			restDays: input.restDays ?? undefined,
			purpose: input.purpose ?? undefined,
			peClassification: input.peClassification ?? undefined,
		},
		(message) => new InvalidDocumentDraftError(message),
	);
}

function toFields(draft: MedicalCertificateDraft) {
	return {
		type: draft.type,
		examinedAt: dateOnly(draft.examinedOn),
		diagnosisText: draft.diagnosisText,
		findings: draft.findings ?? null,
		recommendation: draft.recommendation ?? null,
		isFitToWork: draft.isFitToWork ?? null,
		restDays: draft.restDays ?? null,
		restFrom: draft.restFrom ? dateOnly(draft.restFrom) : null,
		restTo: draft.restFrom && draft.restDays ? dateOnly(restUntil(draft.restFrom, draft.restDays)) : null,
		purpose: draft.purpose ?? null,
		peClassification: draft.peClassification ?? null,
	};
}

const state = (row: MedicalCertificateRow) => ({ documentStatus: row.documentStatus, voided: row.isVoid });

function snapshot(row: MedicalCertificateRow) {
	const { encounter: _encounter, signatory: _signatory, ...fields } = row;
	return fields;
}
