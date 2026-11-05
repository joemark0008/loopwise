import { VoidReasonSchema } from '@loopwise/shared/encounter-record';
import { allergyWarnings, type PrescriptionDraft, PrescriptionDraftSchema } from '@loopwise/shared/prescription';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, StaleVersionError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../audit/audit-changes.js';
import { DocumentSequenceService } from '../clinics/document-sequences/document-sequence.service.js';
import {
	assertEditableDraft,
	assertVoidable,
	issueDocument,
	newVerificationCode,
} from '../documents/document-lifecycle.js';
import { DocumentEncounterMismatchError } from '../documents/documents.errors.js';
import type { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { type EncounterContext, EncounterService } from '../encounters/encounter.service.js';
import { EncounterCardService } from '../encounters/encounter-card.service.js';
import { parseInput } from '../patients/parse-input.js';
import { PatientAllergyService } from '../patients/patient-allergy.service.js';
import { parseSignatory, signatoryJson } from '../practitioners/models/document-signatory.model.js';
import { PractitionerService } from '../practitioners/practitioner.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { SavePrescriptionInput } from './dto/prescription.input.js';
import { type Prescription, type PrescriptionRow, toPrescription } from './models/prescription.model.js';
import { type PrescriptionItemData, PrescriptionRepository } from './prescription.repository.js';
import { AllergyWarningError, InvalidPrescriptionDraftError, S2LicenseRequiredError } from './prescriptions.errors.js';

const LABEL = 'prescription';

/**
 * Prescriptions (DESIGN.md §5). A draft gets its Rx number (DocumentSequence `RX`) and verification code when it is
 * created, and is replaced freely. Issuing signs it as the issuing practitioner: the signatory (name, PRC / PTR / S2,
 * clinic letterhead) is frozen and a trigger locks the row; it can then only be voided (status CANCELLED) or
 * dispensed. Generic names are required (RA 6675) and checked against the patient's allergies; a dangerous drug
 * needs the prescriber's S2 license and quantities in words (RA 9165). Everything runs as the user, by staff of the
 * visit's clinic, and every view and change is audited.
 */
@Injectable()
export class PrescriptionService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly prescriptions: PrescriptionRepository,
		private readonly encounters: EncounterService,
		private readonly cards: EncounterCardService,
		private readonly practitioners: PractitionerService,
		private readonly allergies: PatientAllergyService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** For the print view, with the signatory (the issue-time snapshot, or today's for a draft); audited as PRINT. */
	getForPrint(userId: string, id: string): Promise<Prescription | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.prescriptions.findById(tx, id);
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
				event: 'prescription.print',
				entityType: 'Prescription',
				entityId: row.id,
				userId,
				patientId: row.encounter.patientId,
				organizationId: encounter?.organizationId,
				clinicId: row.encounter.clinicId,
			});
			return toPrescription(row, signatory);
		});
	}

	/** The prescriptions of the encounters (newest first), on the user's transaction. */
	async listForEncounters(tx: ClinicalTx, encounterIds: readonly string[]): Promise<Prescription[]> {
		return (await this.prescriptions.listByEncounters(tx, encounterIds)).map((row) => toPrescription(row));
	}

	/**
	 * Creates a draft (Rx number and verification code assigned now), or replaces the draft `id` (refused once issued,
	 * or with STALE_VERSION when it changed since `expectedVersion`). The user signs as its practitioner. With
	 * `wiseOrigin` (a `propose_prescription` card) verified and settled in the same transaction.
	 */
	async save(userId: string, input: SavePrescriptionInput): Promise<Prescription> {
		const draft = parseDraft(input);
		const items = toItemData(draft);
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounters.requireWritable(tx, userId, input.encounterId);
			const card = await this.verifyDraftCard(userId, input.wiseOrigin, encounter);
			const practitioner = await this.practitioners.requireForUser(tx, userId, LABEL);
			const fields = {
				practitionerId: practitioner.id,
				notes: draft.notes ?? null,
				isDangerousDrug: draft.isDangerousDrug,
				s2FormSerialNo: draft.s2FormSerialNo ?? null,
			};
			let before: PrescriptionRow | null = null;
			let row: PrescriptionRow;
			if (input.id) {
				before = await this.prescriptions.findById(tx, input.id);
				if (!before) {
					throw new EntityNotFoundError('Prescription', input.id);
				}
				if (before.encounterId !== encounter.id) {
					throw new DocumentEncounterMismatchError();
				}
				assertEditableDraft(state(before), LABEL, before.rxNo);
				const replaced = await this.prescriptions.replaceDraft(
					tx,
					before.id,
					fields,
					items,
					input.expectedVersion,
				);
				if (!replaced) {
					throw new StaleVersionError(
						'Prescription',
						input.expectedVersion ?? before.version,
						before.version,
					);
				}
				row = replaced;
			} else {
				row = await this.prescriptions.create(
					tx,
					{
						...fields,
						rxNo: await this.sequences.next(
							tx,
							{ id: encounter.clinicId, code: encounter.clinicCode },
							'RX',
						),
						verificationCode: newVerificationCode(),
						encounterId: encounter.id,
					},
					items,
				);
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { entityType: 'Prescription', entityId: row.id });
			}
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: 'prescription.save',
				entityType: 'Prescription',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: before
					? auditChanges({ ...snapshot(before) }, { ...snapshot(row) })
					: { after: auditSnapshot(snapshot(row)) },
				origin: card?.origin,
			});
			return toPrescription(row);
		});
	}

	/**
	 * Issues the draft as the signed-in practitioner: refused while an item matches a recorded allergy unless
	 * `overrideAllergyWarning` (recorded in the audit row), and for a dangerous drug without the prescriber's S2
	 * license. Freezes the signatory; locked from then on.
	 */
	async issue(
		userId: string,
		id: string,
		overrideAllergyWarning: boolean,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<Prescription> {
		return this.db.asUser(userId, async (tx) => {
			const current = await this.prescriptions.findById(tx, id);
			if (!current) {
				throw new EntityNotFoundError('Prescription', id);
			}
			const encounter = await this.encounters.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, wiseOrigin, encounter, 'issuePrescription');
			const change = issueDocument(state(current), LABEL, current.rxNo);
			const warnings = allergyWarnings(current.items, await this.allergies.listActiveOn(tx, encounter.patientId));
			if (warnings.length > 0 && !overrideAllergyWarning) {
				throw new AllergyWarningError(warnings);
			}
			const practitioner = await this.practitioners.requireForUser(tx, userId, LABEL);
			if (current.isDangerousDrug && !practitioner.s2LicenseNo) {
				throw new S2LicenseRequiredError();
			}
			const signatory = await this.practitioners.signatory(tx, practitioner.id, encounter.clinicId);
			const row = await this.prescriptions.update(tx, id, {
				...change,
				practitionerId: practitioner.id,
				signatory: signatoryJson(signatory),
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'Prescription', entityId: row.id });
			await this.audit.record(tx, {
				action: 'SIGN',
				event: 'prescription.issue',
				entityType: 'Prescription',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: { before: { documentStatus: 'DRAFT' }, after: { documentStatus: 'ISSUED', rxNo: row.rxNo } },
				reason:
					warnings.length > 0
						? `Allergy warning overridden: ${warnings.map((warning) => warning.genericName).join(', ')}`
						: null,
				origin,
			});
			return toPrescription(row, signatory);
		});
	}

	/** Voids the prescription (draft or issued) with the reason: status CANCELLED; it stays in the record. */
	async void(userId: string, input: VoidEntryInput): Promise<Prescription> {
		const voidReason = parseInput(VoidReasonSchema, input.reason);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.prescriptions.findById(tx, input.id);
			if (!current) {
				throw new EntityNotFoundError('Prescription', input.id);
			}
			const encounter = await this.encounters.requireWritable(tx, userId, current.encounterId);
			const { origin, card } = await this.cards.verify(userId, input.wiseOrigin, encounter, 'voidPrescription');
			assertVoidable(state(current), LABEL, current.rxNo);
			const row = await this.prescriptions.update(tx, input.id, {
				status: 'CANCELLED',
				voidedAt: new Date(),
				voidedById: userId,
				voidReason,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { entityType: 'Prescription', entityId: row.id });
			await this.audit.record(tx, {
				action: 'VOID',
				event: 'prescription.void',
				entityType: 'Prescription',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(
					{ status: current.status, voidedAt: current.voidedAt },
					{ status: row.status, voidedAt: row.voidedAt },
				),
				reason: voidReason,
				origin,
			});
			return toPrescription(row);
		});
	}

	/** A `propose_prescription` card, checked against the visit's organization and patient. */
	private async verifyDraftCard(
		userId: string,
		wiseOrigin: WiseOriginInput | null | undefined,
		encounter: EncounterContext,
	) {
		if (!wiseOrigin) {
			return undefined;
		}
		const card = await this.wiseProposals.verify(userId, wiseOrigin, {
			toolNames: ['propose_prescription'],
			organizationId: encounter.organizationId,
		});
		assertCardPatient(card, encounter.patientId);
		return card;
	}
}

function parseDraft(input: SavePrescriptionInput): PrescriptionDraft {
	const withoutNulls = <T extends object>(value: T) =>
		Object.fromEntries(Object.entries(value).map(([key, field]) => [key, field ?? undefined]));
	return parseInput(
		PrescriptionDraftSchema,
		{
			notes: input.notes ?? undefined,
			isDangerousDrug: input.isDangerousDrug ?? undefined,
			s2FormSerialNo: input.s2FormSerialNo ?? undefined,
			items: input.items.map((item) => withoutNulls(item)),
		},
		(message) => new InvalidPrescriptionDraftError(message),
	);
}

function toItemData(draft: PrescriptionDraft): PrescriptionItemData[] {
	return draft.items.map((item, sortOrder) => ({
		sortOrder,
		genericName: item.genericName,
		brandName: item.brandName ?? null,
		strength: item.strength ?? null,
		dosageForm: item.dosageForm ?? null,
		quantity: item.quantity,
		quantityInWords: item.quantityInWords ?? null,
		unit: item.unit ?? null,
		sig: item.sig,
		route: item.route ?? 'PO',
		frequency: item.frequency ?? null,
		durationDays: item.durationDays ?? null,
		isPrn: item.isPrn,
	}));
}

const state = (row: PrescriptionRow) => ({ documentStatus: row.documentStatus, voided: row.voidedAt !== null });

function snapshot(row: PrescriptionRow) {
	return {
		rxNo: row.rxNo,
		notes: row.notes,
		isDangerousDrug: row.isDangerousDrug,
		items: row.items.map(
			(item) => `${item.genericName} ${item.strength ?? ''} — ${item.sig} #${item.quantity.toString()}`,
		),
	};
}
