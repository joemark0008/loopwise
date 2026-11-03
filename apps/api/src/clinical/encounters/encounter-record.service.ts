import { Injectable } from '@nestjs/common';
import {
	AllergyDraftSchema,
	DiagnosisDraftSchema,
	EncounterNoteSchema,
	VoidReasonSchema,
} from '@quarry/shared/encounter-record';
import { searchIcd10 } from '@quarry/shared/icd10';
import type { proposeEncounterNote } from '@quarry/shared/tools';
import { computeBmi, VitalsDraftSchema } from '@quarry/shared/vitals';
import { type WiseActionMutation, wiseActionToolsFor } from '@quarry/shared/wise-actions';
import { staleEditMessage } from '@quarry/shared/wise-proposal';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { toEncounterBill } from '../billing/models/encounter-bill.model.js';
import { toMedicalCertificate } from '../medical-certificates/models/medical-certificate.model.js';
import { toClinicalOrder } from '../orders/models/order.model.js';
import { toPrescription } from '../prescriptions/models/prescription.model.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import {
	assertCardPatient,
	type VerifiedWiseCard,
	type WiseOrigin,
	WiseProposalService,
} from '../wise-proposals/wise-proposal.service.js';
import type {
	AddAllergyInput,
	AddDiagnosisInput,
	RecordVitalsInput,
	UpdateDiagnosisInput,
	UpdateEncounterNoteInput,
	VoidAllergyInput,
	VoidEntryInput,
} from './dto/encounter-record.input.js';
import { EncounterRepository } from './encounter.repository.js';
import { toEncounter } from './encounter.service.js';
import { dateOnly, encounterForWrite, parseOrThrow } from './encounter-access.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import type { Encounter } from './models/encounter.model.js';
import {
	type EncounterDiagnosis,
	type EncounterRecord,
	type Icd10Code,
	type PatientAllergy,
	toAllergy,
	toDiagnosis,
	toVitalSigns,
	type VitalSigns,
} from './models/encounter-record.model.js';
import type { PatientOverview } from './models/patient-overview.model.js';

/** How many visits the chart overview reads. */
const OVERVIEW_VISITS = 20;

/**
 * The record of an encounter (DESIGN.md §7): the SOAP note, vitals, ICD-10 diagnoses and the patient's allergies, and
 * the whole record in one read. Everything runs as the user under row-level security; only staff at the encounter's
 * facility add to it. Every view and change writes an audit row in the same transaction. Wrong entries are voided.
 */
/** What `propose_encounter_note` drafts from. */
export type EncounterNoteForWise = Omit<proposeEncounterNote.Output, '_version' | 'success'>;

@Injectable()
export class EncounterRecordService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounters: EncounterRepository,
		private readonly records: EncounterRecordRepository,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** Null when the user may not see the encounter. */
	async get(userId: string, encounterId: string): Promise<EncounterRecord | null> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const row = await this.records.findRecord(tx, encounterId);
			if (!row) {
				return null;
			}
			const allergies = await this.records.listAllergies(tx, row.patientId);
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'encounter.view',
				resource: 'encounter',
				resourceId: row.id,
			});
			return {
				encounter: toEncounter(row),
				vitals: row.vitalSigns.map(toVitalSigns),
				diagnoses: row.diagnoses.map(toDiagnosis),
				allergies: allergies.map(toAllergy),
				orders: row.orders.map(toClinicalOrder),
				prescriptions: row.prescriptions.map((prescription) => toPrescription(prescription)),
				medicalCertificates: row.certificates.map((certificate) => toMedicalCertificate(certificate)),
				bills: row.bills.map(toEncounterBill),
				canEdit: facilityIds.includes(row.orgId),
			};
		});
	}

	/**
	 * The note of one of the patient's encounters (the latest when no id) for `propose_encounter_note`, read as the user
	 * and audited as a view, with the version the card confirms against. Only staff at its facility may change it.
	 */
	async getNoteForWise(userId: string, patientId: string, encounterId?: string): Promise<EncounterNoteForWise> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const row = await this.encounters.findOfPatient(tx, patientId, encounterId);
			if (!row) {
				throw new HandlerError(
					'NOT_FOUND',
					encounterId ? 'This patient has no such encounter.' : 'This patient has no encounters yet.',
				);
			}
			if (!facilityIds.includes(row.orgId)) {
				throw new HandlerError('FORBIDDEN', 'Only staff at the facility of the visit can change its note.');
			}
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId,
				action: 'encounter.view',
				resource: 'encounter',
				resourceId: row.id,
				reason: 'Wise propose_encounter_note',
			});
			const { followUpOn, ...note } = toEncounter(row);
			return {
				encounter: { id: row.id, startedAt: row.startedAt.toISOString(), facilityName: row.organization.name },
				patientName: `${row.patient.givenName} ${row.patient.familyName}`,
				current: {
					reason: note.reason,
					history: note.history,
					physicalExam: note.physicalExam,
					assessment: note.assessment,
					plan: note.plan,
					patientInstructions: note.patientInstructions,
					followUpOn,
					notes: note.notes,
				},
				version: row.version,
			};
		});
	}

	searchIcd10(query: string): Icd10Code[] {
		return searchIcd10(query);
	}

	/**
	 * With `expectedVersion`, a note that changed since the edit was drafted is refused (CONFLICT). With `wiseOrigin`,
	 * the Wise card is verified and settled in the same transaction, and the audit row records it.
	 */
	async updateNote(userId: string, input: UpdateEncounterNoteInput): Promise<Encounter> {
		const { encounterId, expectedVersion, wiseOrigin, ...fields } = input;
		const note = parseOrThrow(EncounterNoteSchema, fields);
		const card = wiseOrigin
			? await this.wiseProposals.verify(userId, wiseOrigin, { toolNames: ['propose_encounter_note'] })
			: undefined;
		return this.write(userId, encounterId, async (tx, encounter) => {
			assertCardPatient(card, encounter.patientId);
			const row = await this.encounters.updateNote(
				tx,
				encounter.id,
				{
					reason: note.reason,
					history: note.history ?? null,
					physicalExam: note.physicalExam ?? null,
					assessment: note.assessment ?? null,
					plan: note.plan ?? null,
					patientInstructions: note.patientInstructions ?? null,
					followUpOn: note.followUpOn ? dateOnly(note.followUpOn) : null,
					notes: note.notes ?? null,
				},
				expectedVersion,
			);
			if (!row) {
				throw new HandlerError('CONFLICT', staleEditMessage('note'));
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'encounter', resourceId: row.id });
			}
			return {
				result: toEncounter(row),
				action: 'encounter.update_note',
				resource: 'encounter',
				resourceId: row.id,
				origin: card?.origin,
			};
		});
	}

	/**
	 * With `wiseOrigin`: the vitals a confirmed `propose_encounter` drafted (a follow-up of that card), or a
	 * `propose_vitals` card, verified at the visit's facility and settled in the same transaction.
	 */
	async recordVitals(userId: string, input: RecordVitalsInput): Promise<VitalSigns> {
		const { encounterId, wiseOrigin, ...fields } = input;
		const vitals = parseOrThrow(VitalsDraftSchema, fields);
		const { origin, card } = await this.encounterCard(userId, wiseOrigin, encounterId, 'recordVitals');
		return this.write(userId, encounterId, async (tx, encounter) => {
			assertCardPatient(card, encounter.patientId);
			const row = await this.records.createVitals(tx, {
				...vitals,
				bmi: computeBmi(vitals.weightKg, vitals.heightCm) ?? null,
				encounterId: encounter.id,
				patientId: encounter.patientId,
				orgId: encounter.orgId,
				recordedById: userId,
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'vital_signs', resourceId: row.id });
			}
			return {
				result: toVitalSigns(row),
				action: 'vitals.record',
				resource: 'vital_signs',
				resourceId: row.id,
				origin,
			};
		});
	}

	async voidVitals(userId: string, input: VoidEntryInput): Promise<VitalSigns> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		const encounterId = await this.db.asUser(
			userId,
			async (tx) => (await this.records.findVitals(tx, input.id))?.encounterId,
		);
		return this.write(userId, encounterId, async (tx, encounter) => {
			const card = await this.wiseProposals.verifyAction(userId, input.wiseOrigin, 'voidVitals', encounter.orgId);
			assertCardPatient(card, encounter.patientId);
			const current = await this.records.findVitals(tx, input.id);
			if (current?.voidedAt) {
				throw new HandlerError('CONFLICT', 'These vitals are already voided.');
			}
			const row = await this.records.voidVitals(tx, input.id, { voidedById: userId, voidReason });
			await this.wiseProposals.settleAction(tx, userId, card, { resource: 'vital_signs', resourceId: row.id });
			return {
				origin: card?.origin,
				result: toVitalSigns(row),
				action: 'vitals.void',
				resource: 'vital_signs',
				resourceId: row.id,
				reason: voidReason,
			};
		});
	}

	async addDiagnosis(userId: string, input: AddDiagnosisInput): Promise<EncounterDiagnosis> {
		const { encounterId, wiseOrigin, ...fields } = input;
		const { origin, card } = await this.encounterCard(userId, wiseOrigin, encounterId, 'addDiagnosis');
		const diagnosis = parseOrThrow(DiagnosisDraftSchema, {
			...fields,
			certainty: fields.certainty ?? undefined,
			isPrimary: fields.isPrimary ?? undefined,
		});
		return this.write(userId, encounterId, async (tx, encounter) => {
			assertCardPatient(card, encounter.patientId);
			const count = await this.records.countDiagnoses(tx, encounter.id);
			// The first diagnosis is the primary one unless the clinician says otherwise.
			const isPrimary = fields.isPrimary ?? count === 0;
			if (isPrimary) {
				await this.records.clearPrimary(tx, encounter.id);
			}
			const row = await this.records.createDiagnosis(tx, {
				...diagnosis,
				isPrimary,
				notes: diagnosis.notes ?? null,
				rank: count,
				encounterId: encounter.id,
				patientId: encounter.patientId,
				orgId: encounter.orgId,
				recordedById: userId,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'encounter_diagnosis',
				resourceId: row.id,
			});
			return {
				result: toDiagnosis(row),
				action: 'diagnosis.add',
				resource: 'encounter_diagnosis',
				resourceId: row.id,
				origin,
			};
		});
	}

	async updateDiagnosis(userId: string, input: UpdateDiagnosisInput): Promise<EncounterDiagnosis> {
		const encounterId = await this.db.asUser(
			userId,
			async (tx) => (await this.records.findDiagnosis(tx, input.id))?.encounterId,
		);
		return this.write(userId, encounterId, async (tx, encounter) => {
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'updateDiagnosis',
				encounter.orgId,
			);
			assertCardPatient(card, encounter.patientId);
			const current = await this.records.findDiagnosis(tx, input.id);
			if (current?.voidedAt) {
				throw new HandlerError('CONFLICT', 'This diagnosis is voided.');
			}
			if (input.isPrimary) {
				await this.records.clearPrimary(tx, encounter.id);
			}
			const data: Prisma.EncounterDiagnosisUncheckedUpdateInput = {};
			if (input.certainty) {
				data.certainty = input.certainty;
			}
			if (typeof input.isPrimary === 'boolean') {
				data.isPrimary = input.isPrimary;
			}
			if (input.notes !== undefined) {
				data.notes = input.notes?.trim() || null;
			}
			const row = await this.records.updateDiagnosis(tx, input.id, data);
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'encounter_diagnosis',
				resourceId: row.id,
			});
			return {
				result: toDiagnosis(row),
				action: 'diagnosis.update',
				resource: 'encounter_diagnosis',
				resourceId: row.id,
				origin: card?.origin,
			};
		});
	}

	async voidDiagnosis(userId: string, input: VoidEntryInput): Promise<EncounterDiagnosis> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		const encounterId = await this.db.asUser(
			userId,
			async (tx) => (await this.records.findDiagnosis(tx, input.id))?.encounterId,
		);
		return this.write(userId, encounterId, async (tx, encounter) => {
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'voidDiagnosis',
				encounter.orgId,
			);
			assertCardPatient(card, encounter.patientId);
			const current = await this.records.findDiagnosis(tx, input.id);
			if (current?.voidedAt) {
				throw new HandlerError('CONFLICT', 'This diagnosis is already voided.');
			}
			const row = await this.records.updateDiagnosis(tx, input.id, {
				voidedAt: new Date(),
				voidedById: userId,
				voidReason,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'encounter_diagnosis',
				resourceId: row.id,
			});
			return {
				origin: card?.origin,
				result: toDiagnosis(row),
				action: 'diagnosis.void',
				resource: 'encounter_diagnosis',
				resourceId: row.id,
				reason: voidReason,
			};
		});
	}

	/**
	 * The chart's overview (DESIGN.md §9): the latest visits with their diagnoses, prescriptions, orders and bill, and
	 * the summaries drawn from them (recent vitals for trends, problems, medicines, results). Read as the user, so it is
	 * empty for a patient not in your care; audited as one view of the patient's record.
	 */
	async getPatientOverview(userId: string, patientId: string): Promise<PatientOverview> {
		return this.db.asUser(userId, async (tx) => {
			const rows = await this.records.listVisits(tx, patientId, OVERVIEW_VISITS);
			if (rows.length > 0) {
				await this.audit.write(tx, {
					userId,
					orgId: rows[0].orgId,
					patientId,
					action: 'patient.overview',
					resource: 'patient',
					resourceId: patientId,
				});
			}
			const problems = new Map<string, EncounterDiagnosis>();
			for (const row of rows) {
				for (const diagnosis of row.diagnoses) {
					if (!problems.has(diagnosis.icd10Code)) {
						problems.set(diagnosis.icd10Code, toDiagnosis(diagnosis));
					}
				}
			}
			const orders = rows.flatMap((row) => row.orders);
			return {
				visits: rows.map((row) => ({
					encounter: toEncounter(row),
					diagnoses: row.diagnoses.map(toDiagnosis),
					prescriptions: row.prescriptions.map((prescription) => toPrescription(prescription)),
					orders: row.orders.map(toClinicalOrder),
					billStatus: row.bills[0]?.status ?? null,
				})),
				recentVitals: rows
					.flatMap((row) => row.vitalSigns)
					.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
					.slice(0, 6)
					.map(toVitalSigns),
				problems: [...problems.values()],
				medicines: rows
					.flatMap((row) => row.prescriptions)
					.slice(0, 3)
					.map((prescription) => toPrescription(prescription)),
				results: orders
					.filter((order) => order.results.length > 0)
					.slice(0, 6)
					.map(toClinicalOrder),
			};
		});
	}

	/**
	 * The patient's active allergies for the chart's patient banner, read as the user (empty when the patient is not in
	 * your care). The chart's patient read is the audited view; this is part of it.
	 */
	async listAllergies(userId: string, patientId: string): Promise<PatientAllergy[]> {
		return this.db.asUser(userId, async (tx) => (await this.records.listAllergies(tx, patientId)).map(toAllergy));
	}

	async addAllergy(userId: string, input: AddAllergyInput): Promise<PatientAllergy> {
		const { patientId, facilityId, wiseOrigin, ...fields } = input;
		if (!(await this.facilityIds(userId)).includes(facilityId)) {
			throw new HandlerError('FORBIDDEN', 'You can only record allergies at a facility you work at.');
		}
		const card = wiseOrigin
			? await this.wiseProposals.verify(userId, wiseOrigin, {
					toolNames: wiseActionToolsFor('addAllergy'),
					facilityId,
				})
			: undefined;
		assertCardPatient(card, patientId);
		const allergy = parseOrThrow(AllergyDraftSchema, {
			...fields,
			kind: fields.kind ?? undefined,
			severity: fields.severity ?? undefined,
		});
		return this.db.asUser(userId, async (tx) => {
			if (!(await this.encounters.isPatientVisible(tx, patientId))) {
				throw new HandlerError('NOT_FOUND', 'Patient not found.');
			}
			const row = await this.records.createAllergy(tx, {
				...allergy,
				reaction: allergy.reaction ?? null,
				severity: allergy.severity ?? null,
				patientId,
				orgId: facilityId,
				recordedById: userId,
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'patient_allergy', resourceId: row.id });
			}
			await this.audit.write(tx, {
				userId,
				orgId: facilityId,
				patientId,
				action: 'allergy.add',
				resource: 'patient_allergy',
				resourceId: row.id,
				origin: card?.origin,
			});
			return toAllergy(row);
		});
	}

	async voidAllergy(userId: string, input: VoidAllergyInput): Promise<PatientAllergy> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		const facilityIds = await this.facilityIds(userId);
		const recordedAt = await this.db.asUser(
			userId,
			async (tx) => (await this.records.findAllergy(tx, input.id))?.orgId,
		);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, {
					toolNames: wiseActionToolsFor('voidAllergy'),
					facilityId: recordedAt,
				})
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const current = await this.records.findAllergy(tx, input.id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Allergy not found.');
			}
			assertCardPatient(card, current.patientId);
			if (!facilityIds.includes(current.orgId)) {
				throw new HandlerError('FORBIDDEN', 'Only the facility that recorded the allergy can void it.');
			}
			if (current.voidedAt) {
				throw new HandlerError('CONFLICT', 'This allergy is already voided.');
			}
			const row = await this.records.voidAllergy(tx, input.id, { voidedById: userId, voidReason });
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'patient_allergy', resourceId: row.id });
			}
			await this.audit.write(tx, {
				userId,
				orgId: row.orgId,
				patientId: row.patientId,
				action: 'allergy.void',
				resource: 'patient_allergy',
				resourceId: row.id,
				reason: voidReason,
				origin: card?.origin,
			});
			return toAllergy(row);
		});
	}

	/**
	 * The Wise card behind a write to an encounter: a follow-up of a confirmed `propose_encounter` (its origin only; it
	 * is settled already), or a Wise action card for `mutation`, verified at the visit's facility, which the caller
	 * settles in its transaction.
	 */
	private async encounterCard(
		userId: string,
		wiseOrigin: WiseOriginInput | null | undefined,
		encounterId: string,
		mutation: WiseActionMutation,
	): Promise<{ origin?: WiseOrigin; card?: VerifiedWiseCard }> {
		if (!wiseOrigin) {
			return {};
		}
		if (wiseOrigin.toolName === 'propose_encounter') {
			return { origin: await this.encounterCardFollowUp(userId, wiseOrigin, encounterId) };
		}
		const facilityId = await this.db.asUser(
			userId,
			async (tx) => (await this.encounters.findById(tx, encounterId))?.orgId,
		);
		const card = await this.wiseProposals.verify(userId, wiseOrigin, {
			toolNames: wiseActionToolsFor(mutation),
			facilityId,
		});
		return { origin: card.origin, card };
	}

	/** The origin of the vitals or a diagnosis a confirmed `propose_encounter` card drafted for this encounter. */
	private async encounterCardFollowUp(
		userId: string,
		wiseOrigin: WiseOriginInput | null | undefined,
		encounterId: string,
	): Promise<WiseOrigin | undefined> {
		return wiseOrigin
			? this.wiseProposals.verifyFollowUp(userId, wiseOrigin, {
					toolNames: ['propose_encounter'],
					resourceId: encounterId,
				})
			: undefined;
	}

	private async facilityIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((facility) => facility.id);
	}

	/** Runs `change` on an encounter the user may add to, and writes its audit row in the same transaction. */
	private async write<T>(
		userId: string,
		encounterId: string | undefined,
		change: (
			tx: Prisma.TransactionClient,
			encounter: Awaited<ReturnType<typeof encounterForWrite>>,
		) => Promise<{
			result: T;
			action: string;
			resource: string;
			resourceId: string;
			reason?: string;
			origin?: WiseOrigin;
		}>,
	): Promise<T> {
		if (!encounterId) {
			throw new HandlerError('NOT_FOUND', 'Not found.');
		}
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, encounterId);
			const { result, ...entry } = await change(tx, encounter);
			await this.audit.write(tx, { userId, orgId: encounter.orgId, patientId: encounter.patientId, ...entry });
			return result;
		});
	}
}
