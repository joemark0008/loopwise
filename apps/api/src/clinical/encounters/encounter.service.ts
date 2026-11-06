import { EncounterDraftSchema } from '@loopwise/shared/encounter';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { EntityNotFoundError, StaleVersionError } from '../../common/errors/domain-error.js';
import { AuditService } from '../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../audit/audit-changes.js';
import { DocumentSequenceService } from '../clinics/document-sequences/document-sequence.service.js';
import { CareClinicService } from '../patients/care-clinic.service.js';
import { parseInput } from '../patients/parse-input.js';
import { PractitionerService } from '../practitioners/practitioner.service.js';
import { ClinicalDbService, type ClinicalTx } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { ClinicEncountersInput, CreateEncounterInput, TransitionEncounterInput } from './dto/encounter.input.js';
import { type EncounterContextRow, EncounterRepository } from './encounter.repository.js';
import { INITIAL_ENCOUNTER_STATUSES, transitionEncounterStatus } from './encounter-status.js';
import { EncounterStatusEvents, type EncounterStatusTrigger } from './encounter-status-events.js';
import type { EncounterStatus } from './encounters.enums.js';
import {
	EncounterCancelledError,
	EncounterClinicAccessError,
	InvalidInitialEncounterStatusError,
	InvalidSourceChatError,
} from './encounters.errors.js';
import { type Encounter, toEncounter } from './models/encounter.model.js';

/** An encounter a module is about to read or write, with what access checks and audit rows need. */
export interface EncounterContext {
	id: string;
	encounterNo: string;
	patientId: string;
	clinicId: string;
	clinicCode: string;
	clinicName: string;
	organizationId: string;
	practitionerId: string | null;
	status: EncounterStatus;
	version: number;
	startedAt: Date;
	patientName: string;
}

const ACTIVE_STATUSES: readonly EncounterStatus[] = ['OPEN', 'IN_PROGRESS', 'FOR_BILLING', 'COMPLETED'];

/**
 * Encounters (DESIGN.md §5): the visit every clinical record hangs off. A visit is opened at one of the user's
 * clinics, numbered from the clinic's ENCOUNTER sequence, and moves along `transitionEncounterStatus`. Reads run as
 * the user (row-level security). Opening a visit and taking it as the doctor also grant the user a care relationship,
 * which is system work: the user's access is checked as the user first, then the write runs as one system
 * transaction with its audit row.
 *
 * Other modules add to a visit's record through `requireWritable` / `findReadable` on their own transaction.
 */
@Injectable()
export class EncounterService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounters: EncounterRepository,
		private readonly clinics: CareClinicService,
		private readonly practitioners: PractitionerService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly chats: ChatRepository,
		private readonly wiseProposals: WiseProposalService,
		private readonly statusEvents: EncounterStatusEvents,
	) {}

	/** The patient's visits, newest first; empty when the user may not see the patient. Not audited: a list. */
	list(userId: string, patientId: string, take?: number): Promise<Encounter[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.encounters.listByPatient(tx, patientId, take)).map(toEncounter),
		);
	}

	/** The visits at a clinic the user works at, by status (default: not cancelled), oldest first. */
	async listAtClinic(userId: string, input: ClinicEncountersInput): Promise<Encounter[]> {
		await this.clinics.require(userId, input.clinicId, 'see the visits');
		return this.db.asUser(userId, async (tx) =>
			(
				await this.encounters.listAtClinic(tx, {
					clinicId: input.clinicId,
					statuses: input.statuses?.length ? input.statuses : ACTIVE_STATUSES,
					startedFrom: input.startedFrom ? new Date(input.startedFrom) : undefined,
				})
			).map(toEncounter),
		);
	}

	/**
	 * Opens a visit at a clinic the user works at, for a patient of the clinic's organization they may see:
	 * `encounterNo` from the clinic's sequence, the user's practitioner as the doctor (if they are one), OPEN or
	 * IN_PROGRESS (default IN_PROGRESS for a practitioner, OPEN at the front desk), and a care relationship for the
	 * user. With `wiseOrigin` (a `propose_encounter` card) verified and settled in the same transaction.
	 */
	async create(userId: string, input: CreateEncounterInput): Promise<Encounter> {
		const clinic = await this.clinics.require(userId, input.clinicId, 'record visits');
		const draft = parseInput(EncounterDraftSchema, {
			reason: input.reason,
			type: input.type ?? undefined,
			notes: input.notes ?? undefined,
			startedAt: input.startedAt ?? undefined,
		});
		if (input.status && !INITIAL_ENCOUNTER_STATUSES.includes(input.status)) {
			throw new InvalidInitialEncounterStatusError(input.status);
		}
		if (input.sourceChatId) {
			const chat = await this.chats.getChatPatient(input.sourceChatId);
			if (chat?.userId !== userId || chat.patientId !== input.patientId) {
				throw new InvalidSourceChatError();
			}
		}
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, {
					toolNames: ['propose_encounter'],
					organizationId: clinic.organizationId,
				})
			: undefined;
		assertCardPatient(card, input.patientId);

		const { patient, practitionerId } = await this.db.asUser(userId, async (tx) => ({
			patient: await this.encounters.findPatientOrganization(tx, input.patientId),
			practitionerId: await this.practitioners.findIdForUser(tx, userId),
		}));
		if (!patient || patient.organizationId !== clinic.organizationId) {
			throw new EntityNotFoundError('Patient', input.patientId);
		}

		return this.db.asSystem(async (tx) => {
			const startedAt = draft.startedAt ? new Date(draft.startedAt) : new Date();
			const row = await this.encounters.create(tx, {
				encounterNo: await this.sequences.next(tx, clinic, 'ENCOUNTER', startedAt),
				clinicId: clinic.id,
				patientId: input.patientId,
				practitionerId,
				type: draft.type,
				status: input.status ?? (practitionerId ? 'IN_PROGRESS' : 'OPEN'),
				chiefComplaint: draft.reason,
				notes: draft.notes ?? null,
				sourceChatId: input.sourceChatId ?? null,
				createdById: userId,
				startedAt,
			});
			await this.encounters.addCareRelationship(tx, {
				patientId: input.patientId,
				userId,
				organizationId: clinic.organizationId,
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { entityType: 'Encounter', entityId: row.id });
			}
			await this.audit.created(tx, {
				event: 'encounter.create',
				entityType: 'Encounter',
				entityId: row.id,
				userId,
				patientId: input.patientId,
				organizationId: clinic.organizationId,
				clinicId: clinic.id,
				changes: { after: auditSnapshot(row) },
				origin: card?.origin,
			});
			return toEncounter(row);
		});
	}

	/**
	 * Opens the visit of a patient checked in at the front desk (scheduling's check-in), on the caller's system
	 * transaction so the ticket and the appointment change with it: OPEN, `encounterNo` from the clinic's sequence, the
	 * booked doctor and the appointment (1:1). The doctor's user gets a care relationship, so the visit reaches their
	 * line. The caller checks the user's desk role, the clinic and the patient first.
	 */
	async openForCheckIn(
		tx: ClinicalTx,
		userId: string,
		visit: {
			clinic: { id: string; code: string; organizationId: string };
			patientId: string;
			practitionerId: string;
			appointmentId: string;
			type: Encounter['type'];
			chiefComplaint: string | null;
		},
	): Promise<Encounter> {
		const startedAt = new Date();
		const row = await this.encounters.create(tx, {
			encounterNo: await this.sequences.next(tx, visit.clinic, 'ENCOUNTER', startedAt),
			clinicId: visit.clinic.id,
			patientId: visit.patientId,
			practitionerId: visit.practitionerId,
			appointmentId: visit.appointmentId,
			type: visit.type,
			status: 'OPEN',
			chiefComplaint: visit.chiefComplaint,
			createdById: userId,
			startedAt,
		});
		const [doctor] = await this.practitioners.findManyByIds(tx, [visit.practitionerId]);
		if (doctor?.userId) {
			await this.encounters.addCareRelationship(tx, {
				patientId: visit.patientId,
				userId: doctor.userId,
				organizationId: visit.clinic.organizationId,
			});
		}
		await this.audit.created(tx, {
			event: 'encounter.create',
			entityType: 'Encounter',
			entityId: row.id,
			userId,
			patientId: visit.patientId,
			organizationId: visit.clinic.organizationId,
			clinicId: visit.clinic.id,
			changes: { after: auditSnapshot(row) },
			reason: 'check-in',
		});
		return toEncounter(row);
	}

	/**
	 * Moves the visit along its status machine (`transitionEncounterStatus`), as staff of its clinic. A practitioner
	 * taking an unassigned visit (→ IN_PROGRESS) becomes its doctor and gets a care relationship. With
	 * `expectedVersion`, a visit changed since is refused (STALE_VERSION).
	 *
	 * The move publishes `EncounterStatusChanged` on its transaction (after the audit row), so what follows the visit
	 * (the queue ticket and the booking, `VisitStatusSync`) moves with it or not at all. `trigger: 'queue'` is for
	 * the queue pages, which move the ticket and booking themselves.
	 */
	async transition(
		userId: string,
		input: TransitionEncounterInput,
		opts: { trigger?: EncounterStatusTrigger } = {},
	): Promise<Encounter> {
		const { encounter, practitionerId } = await this.db.asUser(userId, async (tx) => ({
			encounter: await this.requireWritable(tx, userId, input.encounterId, { allowCancelled: true }),
			practitionerId: await this.practitioners.findIdForUser(tx, userId),
		}));
		const change = transitionEncounterStatus(encounter.status, input.status);
		const takesVisit = input.status === 'IN_PROGRESS' && !encounter.practitionerId && practitionerId !== null;

		return this.db.asSystem(async (tx) => {
			const row = await this.encounters.update(
				tx,
				encounter.id,
				{ ...change, ...(takesVisit && { practitionerId }) },
				input.expectedVersion ?? encounter.version,
			);
			if (!row) {
				throw new StaleVersionError('Encounter', input.expectedVersion ?? encounter.version);
			}
			if (takesVisit) {
				await this.encounters.addCareRelationship(tx, {
					patientId: encounter.patientId,
					userId,
					organizationId: encounter.organizationId,
				});
			}
			await this.audit.updated(tx, {
				event: `encounter.${input.status.toLowerCase()}`,
				entityType: 'Encounter',
				entityId: encounter.id,
				userId,
				patientId: encounter.patientId,
				organizationId: encounter.organizationId,
				clinicId: encounter.clinicId,
				changes: auditChanges(
					{ status: encounter.status, practitionerId: encounter.practitionerId },
					{ status: row.status, practitionerId: row.practitionerId },
				),
				reason: input.reason?.trim() || null,
			});
			await this.statusEvents.publish(tx, {
				encounterId: encounter.id,
				patientId: encounter.patientId,
				clinicId: encounter.clinicId,
				organizationId: encounter.organizationId,
				appointmentId: row.appointmentId,
				practitionerId: row.practitionerId,
				from: encounter.status,
				to: row.status,
				userId,
				reason: input.reason?.trim() || null,
				trigger: opts.trigger ?? 'encounter',
			});
			return toEncounter(row);
		});
	}

	/** The encounter as the user may see it (row-level security), or null. */
	async findReadable(tx: ClinicalTx, encounterId: string): Promise<EncounterContext | null> {
		const row = await this.encounters.findById(tx, encounterId);
		return row && toContext(row);
	}

	/**
	 * The encounter a user is adding to, on their transaction: not found when row-level security hides it, refused
	 * unless the user works at its clinic (the policies check the same on write), and closed once cancelled.
	 */
	async requireWritable(
		tx: ClinicalTx,
		userId: string,
		encounterId: string,
		opts: { allowCancelled?: boolean } = {},
	): Promise<EncounterContext> {
		const row = await this.encounters.findById(tx, encounterId);
		if (!row) {
			throw new EntityNotFoundError('Encounter', encounterId);
		}
		if (!(await this.clinics.worksAt(userId, row.clinicId))) {
			throw new EncounterClinicAccessError();
		}
		if (row.status === 'CANCELLED' && !opts.allowCancelled) {
			throw new EncounterCancelledError(row.encounterNo);
		}
		return toContext(row);
	}

	/** One of the patient's encounters (the latest when no id) on the user's transaction; null when hidden. */
	async findOfPatient(tx: ClinicalTx, patientId: string, encounterId?: string): Promise<EncounterContext | null> {
		const row = await this.encounters.findOfPatient(tx, patientId, encounterId);
		return row && toContext(row);
	}
}

function toContext(row: EncounterContextRow): EncounterContext {
	return {
		id: row.id,
		encounterNo: row.encounterNo,
		patientId: row.patientId,
		clinicId: row.clinicId,
		clinicCode: row.clinic.code,
		clinicName: row.clinic.name,
		organizationId: row.clinic.organizationId,
		practitionerId: row.practitionerId,
		status: row.status,
		version: row.version,
		startedAt: row.startedAt,
		patientName: `${row.patient.firstName} ${row.patient.lastName}`,
	};
}
