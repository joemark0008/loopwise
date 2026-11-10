import { EncounterNoteSchema } from '@loopwise/shared/encounter-record';
import type { proposeEncounterNote } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, StaleVersionError } from '../../common/errors/domain-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges } from '../audit/audit-changes.js';
import { dateOnly, parseInput } from '../patients/parse-input.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { UpdateEncounterNoteInput } from './dto/encounter-record.input.js';
import { EncounterRepository } from './encounter.repository.js';
import { EncounterService } from './encounter.service.js';
import { type Encounter, toEncounter } from './models/encounter.model.js';

/** What `propose_encounter_note` drafts from. */
export type EncounterNoteForWise = Omit<proposeEncounterNote.Output, '_version' | 'success'>;

/** The note fields the audit row compares. */
const NOTE_FIELDS = [
	'reason',
	'history',
	'reviewOfSystems',
	'subjective',
	'physicalExam',
	'objective',
	'assessment',
	'plan',
	'patientInstructions',
	'followUpOn',
	'disposition',
	'notes',
] as const;

/**
 * The SOAP note of an encounter (the base schema's chief complaint, history of present illness, review of systems,
 * subjective, physical exam, objective, assessment, plan, follow-up date and disposition, plus Loopwise's notes and
 * patient instructions). The review of systems and the physical exam are stored as JSON string values. Changed as the
 * user, by staff of the visit's clinic, with optimistic locking on `version` for Wise cards.
 */
@Injectable()
export class EncounterNoteService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounters: EncounterRepository,
		private readonly encounterAccess: EncounterService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Saves the note. With `expectedVersion`, a note that changed since the edit was drafted is refused
	 * (STALE_VERSION). With `wiseOrigin` (`propose_encounter_note`), the card is verified and settled in the same
	 * transaction, and the audit row records it. The review of systems, subjective, objective, follow-up date and
	 * disposition are kept as they are when left out (forms and Wise cards that don't show them), and cleared when sent
	 * empty or null.
	 */
	async update(userId: string, input: UpdateEncounterNoteInput): Promise<Encounter> {
		const { encounterId, expectedVersion, wiseOrigin, ...fields } = input;
		const note = parseInput(EncounterNoteSchema, fields);
		const given = (key: 'reviewOfSystems' | 'subjective' | 'objective' | 'followUpOn' | 'disposition') =>
			fields[key] !== undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.encounterAccess.requireWritable(tx, userId, encounterId);
			const card = wiseOrigin
				? await this.wiseProposals.verify(userId, wiseOrigin, {
						toolNames: ['propose_encounter_note'],
						organizationId: encounter.organizationId,
					})
				: undefined;
			assertCardPatient(card, encounter.patientId);
			const before = await this.encounters.findById(tx, encounterId);
			const row = await this.encounters.update(
				tx,
				encounterId,
				{
					chiefComplaint: note.reason,
					historyOfPresentIllness: note.history ?? null,
					// Free text as JSON string values (the base schema's columns are structured JSON).
					...(given('reviewOfSystems') && { reviewOfSystems: note.reviewOfSystems ?? Prisma.DbNull }),
					...(given('subjective') && { subjective: note.subjective ?? null }),
					physicalExam: note.physicalExam ?? Prisma.DbNull,
					...(given('objective') && { objective: note.objective ?? null }),
					assessment: note.assessment ?? null,
					plan: note.plan ?? null,
					patientInstructions: note.patientInstructions ?? null,
					...(given('followUpOn') && { followUpDate: note.followUpOn ? dateOnly(note.followUpOn) : null }),
					...(given('disposition') && { disposition: note.disposition ?? null }),
					notes: note.notes ?? null,
				},
				expectedVersion,
			);
			if (!row) {
				throw new StaleVersionError('Encounter', expectedVersion ?? encounter.version);
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { entityType: 'Encounter', entityId: row.id });
			}
			const after = toEncounter(row);
			await this.audit.updated(tx, {
				event: 'encounter.update_note',
				entityType: 'Encounter',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: before ? auditChanges({ ...toEncounter(before) }, { ...after }, NOTE_FIELDS) : null,
				origin: card?.origin,
			});
			return after;
		});
	}

	/**
	 * The note of one of the patient's encounters (the latest when no id) for `propose_encounter_note`, read as the user
	 * and audited as a view, with the version the card confirms against. Only staff at its clinic may change it.
	 */
	async getForWise(userId: string, patientId: string, encounterId?: string): Promise<EncounterNoteForWise> {
		return this.db.asUser(userId, async (tx) => {
			const found = await this.encounterAccess.findOfPatient(tx, patientId, encounterId);
			if (!found) {
				throw new EntityNotFoundError('Encounter', encounterId);
			}
			const encounter = await this.encounterAccess.requireWritable(tx, userId, found.id);
			const row = (await this.encounters.findById(tx, encounter.id))!;
			await this.audit.view(tx, {
				event: 'encounter.view',
				entityType: 'Encounter',
				entityId: encounter.id,
				userId,
				patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				reason: 'Wise propose_encounter_note',
			});
			const note = toEncounter(row);
			return {
				encounter: {
					id: encounter.id,
					startedAt: encounter.startedAt.toISOString(),
					clinicName: encounter.clinicName,
				},
				patientName: encounter.patientName,
				current: {
					reason: note.reason,
					history: note.history,
					physicalExam: note.physicalExam,
					assessment: note.assessment,
					plan: note.plan,
					patientInstructions: note.patientInstructions,
					followUpOn: note.followUpOn,
					notes: note.notes,
				},
				version: row.version,
			};
		});
	}
}
