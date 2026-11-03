import { Injectable } from '@nestjs/common';
import { VoidReasonSchema } from '@quarry/shared/encounter-record';
import { allergyWarnings, PrescriptionDraftSchema } from '@quarry/shared/prescription';

import { HandlerError } from '../../common/errors/handler-error.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { ClinicianRepository } from '../clinicians/clinician.repository.js';
import type { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { EncounterRepository } from '../encounters/encounter.repository.js';
import { assertSavedFromVersion, encounterForWrite, parseOrThrow } from '../encounters/encounter-access.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { SavePrescriptionInput } from './dto/prescription.input.js';
import { type Prescription, type PrescriptionRow, toPrescription } from './models/prescription.model.js';
import { PrescriptionRepository } from './prescription.repository.js';

/** `RX-20261103-4F2A9C`: the issue date and the start of the id. */
export function documentNumber(prefix: string, id: string, at: Date): string {
	return `${prefix}-${at.toISOString().slice(0, 10).replaceAll('-', '')}-${id.slice(0, 6).toUpperCase()}`;
}

/**
 * Prescriptions (DESIGN.md §7). A draft is saved and replaced freely; issuing snapshots the prescriber (PRC license
 * required) and the facility letterhead, and from then on the row is locked by a trigger: it can only be voided.
 * Everything runs as the user; only staff at the encounter's facility write. Every view and change is audited.
 */
@Injectable()
export class PrescriptionService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly prescriptions: PrescriptionRepository,
		private readonly encounters: EncounterRepository,
		private readonly clinicians: ClinicianRepository,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** For the print view: with the signatory (issue-time snapshot, or today's values for a draft). */
	get(userId: string, id: string): Promise<Prescription | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.prescriptions.findById(tx, id);
			if (!row) {
				return null;
			}
			const signatory =
				row.status === 'draft'
					? await this.clinicians.getSignatory(tx, row.prescriberId, row.orgId)
					: {
							name: row.prescriberName ?? '',
							credentials: null,
							licenseNumber: row.prescriberLicense,
							ptrNumber: row.prescriberPtr,
							facilityName: row.facilityName ?? '',
							facilityAddress: row.facilityAddress,
							facilityPhone: null,
						};
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'prescription.view',
				resource: 'prescription',
				resourceId: row.id,
			});
			return toPrescription(row, signatory);
		});
	}

	async save(userId: string, input: SavePrescriptionInput): Promise<Prescription> {
		const draft = parseOrThrow(PrescriptionDraftSchema, {
			notes: input.notes,
			items: input.items.map((item) => ({ ...item, route: item.route ?? undefined })),
		});
		const items = draft.items.map((item, position) => ({
			...item,
			position,
			brandName: item.brandName ?? null,
			strength: item.strength ?? null,
			form: item.form ?? null,
			durationDays: item.durationDays ?? null,
			quantityUnit: item.quantityUnit ?? null,
			instructions: item.instructions ?? null,
		}));
		const facilityIds = await this.facilityIds(userId);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, { toolNames: ['propose_prescription'] })
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, input.encounterId);
			assertCardPatient(card, encounter.patientId);
			let row: PrescriptionRow;
			if (input.id) {
				const current = await this.prescriptions.findById(tx, input.id);
				if (!current || current.encounterId !== encounter.id) {
					throw new HandlerError('NOT_FOUND', 'Prescription not found.');
				}
				if (current.status !== 'draft') {
					throw new HandlerError('CONFLICT', 'This prescription is issued; void it and write a new one.');
				}
				row = await this.prescriptions.replaceDraft(tx, current.id, draft.notes ?? null, items);
				assertSavedFromVersion(row, input.expectedVersion, 'prescription');
			} else {
				row = await this.prescriptions.create(
					tx,
					{
						encounterId: encounter.id,
						patientId: encounter.patientId,
						orgId: encounter.orgId,
						prescriberId: userId,
						notes: draft.notes ?? null,
					},
					items,
				);
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'prescription', resourceId: row.id });
			}
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'prescription.save',
				resource: 'prescription',
				resourceId: row.id,
				origin: card?.origin,
			});
			return toPrescription(row);
		});
	}

	/**
	 * Issues a draft as the signed-in clinician. Refused while an item matches a recorded allergy, unless the
	 * clinician overrides the warning (the override is in the audit row).
	 */
	async issue(
		userId: string,
		id: string,
		overrideAllergyWarning: boolean,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<Prescription> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.prescriptions.findById(tx, id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Prescription not found.');
			}
			await encounterForWrite(tx, this.encounters, facilityIds, current.encounterId);
			const card = await this.wiseProposals.verifyAction(userId, wiseOrigin, 'issuePrescription', current.orgId);
			assertCardPatient(card, current.patientId);
			if (current.status !== 'draft') {
				throw new HandlerError('CONFLICT', `This prescription is already ${current.status}.`);
			}
			const warnings = allergyWarnings(
				current.items,
				await this.prescriptions.listActiveAllergies(tx, current.patientId),
			);
			if (warnings.length > 0 && !overrideAllergyWarning) {
				const list = warnings
					.map((warning) => `${warning.genericName} (allergy: ${warning.substance})`)
					.join(', ');
				throw new HandlerError(
					'CONFLICT',
					`Allergy warning: ${list}. Review the items or override the warning.`,
				);
			}
			const signatory = await this.clinicians.getSignatory(tx, userId, current.orgId);
			if (!signatory.licenseNumber) {
				throw new HandlerError(
					'BAD_REQUEST',
					'Add your PRC license number (Settings → Account → Clinician profile) before issuing.',
				);
			}
			const issuedAt = new Date();
			const row = await this.prescriptions.update(tx, id, {
				status: 'issued',
				issuedAt,
				rxNumber: documentNumber('RX', id, issuedAt),
				prescriberId: userId,
				prescriberName: [signatory.name, signatory.credentials].filter(Boolean).join(', '),
				prescriberLicense: signatory.licenseNumber,
				prescriberPtr: signatory.ptrNumber,
				facilityName: signatory.facilityName,
				facilityAddress: signatory.facilityAddress,
			});
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'prescription.issue',
				resource: 'prescription',
				resourceId: row.id,
				origin: card?.origin,
				reason:
					warnings.length > 0
						? `Allergy warning overridden: ${warnings.map((w) => w.genericName).join(', ')}`
						: null,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { resource: 'prescription', resourceId: row.id });
			return toPrescription(row);
		});
	}

	async void(userId: string, input: VoidEntryInput): Promise<Prescription> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.prescriptions.findById(tx, input.id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Prescription not found.');
			}
			await encounterForWrite(tx, this.encounters, facilityIds, current.encounterId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'voidPrescription',
				current.orgId,
			);
			assertCardPatient(card, current.patientId);
			if (current.status === 'voided') {
				throw new HandlerError('CONFLICT', 'This prescription is already voided.');
			}
			const row = await this.prescriptions.update(tx, input.id, {
				status: 'voided',
				voidedAt: new Date(),
				voidedById: userId,
				voidReason,
			});
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'prescription.void',
				resource: 'prescription',
				resourceId: row.id,
				reason: voidReason,
				origin: card?.origin,
			});
			await this.wiseProposals.settleAction(tx, userId, card, { resource: 'prescription', resourceId: row.id });
			return toPrescription(row);
		});
	}

	private async facilityIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((facility) => facility.id);
	}
}
