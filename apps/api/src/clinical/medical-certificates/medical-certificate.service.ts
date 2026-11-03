import { Injectable } from '@nestjs/common';
import { VoidReasonSchema } from '@quarry/shared/encounter-record';
import { MedicalCertificateDraftSchema } from '@quarry/shared/medical-certificate';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { MedicalCertificate as MedicalCertificateRow } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { ClinicianRepository } from '../clinicians/clinician.repository.js';
import type { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { EncounterRepository } from '../encounters/encounter.repository.js';
import { assertSavedFromVersion, dateOnly, encounterForWrite, parseOrThrow } from '../encounters/encounter-access.js';
import { documentNumber } from '../prescriptions/prescription.service.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, type WiseOrigin, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { SaveMedicalCertificateInput } from './dto/medical-certificate.input.js';
import { MedicalCertificateRepository } from './medical-certificate.repository.js';
import { type MedicalCertificate, toMedicalCertificate } from './models/medical-certificate.model.js';

/**
 * Medical certificates (DESIGN.md §7), like prescriptions: a draft is saved freely; issuing needs the clinician's PRC
 * license, snapshots the doctor and facility and locks the row (it can only be voided). Every view and change is
 * audited; issuing writes `medical_certificate.issue`.
 */
@Injectable()
export class MedicalCertificateService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly certificates: MedicalCertificateRepository,
		private readonly encounters: EncounterRepository,
		private readonly clinicians: ClinicianRepository,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** For the print view: with the signatory (issue-time snapshot, or today's values for a draft). */
	get(userId: string, id: string): Promise<MedicalCertificate | null> {
		return this.db.asUser(userId, async (tx) => {
			const row = await this.certificates.findById(tx, id);
			if (!row) {
				return null;
			}
			const signatory =
				row.status === 'draft'
					? await this.clinicians.getSignatory(tx, row.issuedById, row.orgId)
					: {
							name: row.doctorName ?? '',
							credentials: null,
							licenseNumber: row.doctorLicense,
							ptrNumber: row.doctorPtr,
							facilityName: row.facilityName ?? '',
							facilityAddress: row.facilityAddress,
							facilityPhone: null,
						};
			await this.writeAudit(tx, userId, row, 'medical_certificate.view');
			return toMedicalCertificate(row, signatory);
		});
	}

	async save(userId: string, input: SaveMedicalCertificateInput): Promise<MedicalCertificate> {
		const { id, encounterId, expectedVersion, wiseOrigin, ...fields } = input;
		const draft = parseOrThrow(MedicalCertificateDraftSchema, { ...fields, fitness: fields.fitness ?? undefined });
		const data = {
			examinedOn: dateOnly(draft.examinedOn),
			diagnosisText: draft.diagnosisText,
			fitness: draft.fitness,
			restFrom: draft.restFrom ? dateOnly(draft.restFrom) : null,
			restDays: draft.restDays ?? null,
			remarks: draft.remarks ?? null,
			purpose: draft.purpose ?? null,
		};
		const facilityIds = await this.facilityIds(userId);
		const card = wiseOrigin
			? await this.wiseProposals.verify(userId, wiseOrigin, { toolNames: ['propose_medical_certificate'] })
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, encounterId);
			assertCardPatient(card, encounter.patientId);
			let row: MedicalCertificateRow;
			if (id) {
				const current = await this.certificates.findById(tx, id);
				if (!current || current.encounterId !== encounter.id) {
					throw new HandlerError('NOT_FOUND', 'Medical certificate not found.');
				}
				if (current.status !== 'draft') {
					throw new HandlerError('CONFLICT', 'This certificate is issued; void it and write a new one.');
				}
				row = await this.certificates.update(tx, id, data);
				assertSavedFromVersion(row, expectedVersion, 'certificate');
			} else {
				row = await this.certificates.create(tx, {
					...data,
					encounterId: encounter.id,
					patientId: encounter.patientId,
					orgId: encounter.orgId,
					issuedById: userId,
				});
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, {
					resource: 'medical_certificate',
					resourceId: row.id,
				});
			}
			await this.writeAudit(tx, userId, row, 'medical_certificate.save', undefined, card?.origin);
			return toMedicalCertificate(row);
		});
	}

	async issue(userId: string, id: string, wiseOrigin?: WiseOriginInput | null): Promise<MedicalCertificate> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.certificates.findById(tx, id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Medical certificate not found.');
			}
			await encounterForWrite(tx, this.encounters, facilityIds, current.encounterId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				wiseOrigin,
				'issueMedicalCertificate',
				current.orgId,
			);
			assertCardPatient(card, current.patientId);
			if (current.status !== 'draft') {
				throw new HandlerError('CONFLICT', `This certificate is already ${current.status}.`);
			}
			const signatory = await this.clinicians.getSignatory(tx, userId, current.orgId);
			if (!signatory.licenseNumber) {
				throw new HandlerError(
					'BAD_REQUEST',
					'Add your PRC license number (Settings → Account → Clinician profile) before issuing.',
				);
			}
			const issuedAt = new Date();
			const row = await this.certificates.update(tx, id, {
				status: 'issued',
				issuedAt,
				certificateNumber: documentNumber('MC', id, issuedAt),
				issuedById: userId,
				doctorName: [signatory.name, signatory.credentials].filter(Boolean).join(', '),
				doctorLicense: signatory.licenseNumber,
				doctorPtr: signatory.ptrNumber,
				facilityName: signatory.facilityName,
				facilityAddress: signatory.facilityAddress,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'medical_certificate',
				resourceId: row.id,
			});
			await this.writeAudit(tx, userId, row, 'medical_certificate.issue', undefined, card?.origin);
			return toMedicalCertificate(row);
		});
	}

	async void(userId: string, input: VoidEntryInput): Promise<MedicalCertificate> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.certificates.findById(tx, input.id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Medical certificate not found.');
			}
			await encounterForWrite(tx, this.encounters, facilityIds, current.encounterId);
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'voidMedicalCertificate',
				current.orgId,
			);
			assertCardPatient(card, current.patientId);
			if (current.status === 'voided') {
				throw new HandlerError('CONFLICT', 'This certificate is already voided.');
			}
			const row = await this.certificates.update(tx, input.id, {
				status: 'voided',
				voidedAt: new Date(),
				voidedById: userId,
				voidReason,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'medical_certificate',
				resourceId: row.id,
			});
			await this.writeAudit(tx, userId, row, 'medical_certificate.void', voidReason, card?.origin);
			return toMedicalCertificate(row);
		});
	}

	private writeAudit(
		tx: Parameters<Parameters<ClinicalDbService['asUser']>[1]>[0],
		userId: string,
		row: MedicalCertificateRow,
		action: string,
		reason?: string,
		origin?: WiseOrigin,
	) {
		return this.audit.write(tx, {
			origin,
			userId,
			orgId: row.orgId,
			patientId: row.patientId,
			action,
			resource: 'medical_certificate',
			resourceId: row.id,
			reason,
		});
	}

	private async facilityIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((facility) => facility.id);
	}
}
