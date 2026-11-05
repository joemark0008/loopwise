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
	'physicalExam',
	'assessment',
	'plan',
	'patientInstructions',
	'followUpOn',
	'disposition',
	'notes',
] as const;

/**
 * The SOAP note of an encounter (the reference's chief complaint, history of present illness, physical exam,
 * assessment, plan, follow-up date and disposition, plus Loopwise's notes and patient instructions). The physical exam
 * is stored as a JSON string value. Changed as the user, by staff of the visit's clinic, with optimistic locking on
 * `version` for Wise cards.
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
	 * transaction, and the audit row records it.
	 */
	async update(userId: string, input: UpdateEncounterNoteInput): Promise<Encounter> {
		const { encounterId, expectedVersion, wiseOrigin, ...fields } = input;
		const note = parseInput(EncounterNoteSchema, fields);
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
					// The free text as a JSON string value (the reference's column is structured JSON).
					physicalExam: note.physicalExam ?? Prisma.DbNull,
					assessment: note.assessment ?? null,
					plan: note.plan ?? null,
					patientInstructions: note.patientInstructions ?? null,
					followUpDate: note.followUpOn ? dateOnly(note.followUpOn) : null,
					disposition: note.disposition ?? null,
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
