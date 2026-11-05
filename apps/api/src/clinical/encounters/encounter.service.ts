import { EncounterDraftSchema } from '@loopwise/shared/encounter';
import { Injectable } from '@nestjs/common';

import { ChatRepository } from '../../chats/chat.repository.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import type { Encounter as EncounterRow } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { CreateEncounterInput } from './dto/encounter.input.js';
import { EncounterRepository } from './encounter.repository.js';
import type { Encounter } from './models/encounter.model.js';

/**
 * Encounters (DESIGN.md §5). Everything runs as the user: row-level security only shows the encounters of patients
 * they may see, and only lets them record one for such a patient at one of their facilities.
 */
@Injectable()
export class EncounterService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly encounters: EncounterRepository,
		private readonly organizations: OrganizationRepository,
		private readonly chats: ChatRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** Newest first; empty when the user may not see the patient. */
	list(userId: string, patientId: string, take?: number): Promise<Encounter[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.encounters.listByPatient(tx, patientId, take)).map(toEncounter),
		);
	}

	async create(userId: string, input: CreateEncounterInput): Promise<Encounter> {
		const facilities = await this.organizations.getUserFacilities(userId);
		if (!facilities.some((facility) => facility.id === input.facilityId)) {
			throw new HandlerError('FORBIDDEN', 'You can only record encounters at a facility you work at.');
		}
		const parsed = EncounterDraftSchema.safeParse({
			reason: input.reason,
			notes: input.notes ?? undefined,
			startedAt: input.startedAt ?? undefined,
		});
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join(' '));
		}
		if (input.sourceChatId) {
			const chat = await this.chats.getChatPatient(input.sourceChatId);
			if (chat?.userId !== userId || chat.patientId !== input.patientId) {
				throw new HandlerError('BAD_REQUEST', "The source chat isn't your chat about this patient.");
			}
		}
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, { toolNames: ['propose_encounter'] })
			: undefined;
		assertCardPatient(card, input.patientId);

		return this.db.asUser(userId, async (tx) => {
			if (!(await this.encounters.isPatientVisible(tx, input.patientId))) {
				throw new HandlerError('NOT_FOUND', 'Patient not found.');
			}
			const encounter = await this.encounters.create(tx, {
				patientId: input.patientId,
				doctorId: userId,
				orgId: input.facilityId,
				reason: parsed.data.reason,
				notes: parsed.data.notes ?? null,
				sourceChatId: input.sourceChatId ?? null,
				...(parsed.data.startedAt && { startedAt: new Date(parsed.data.startedAt) }),
			});
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'encounter', resourceId: encounter.id });
			}
			await this.encounters.writeAudit(tx, {
				userId,
				orgId: input.facilityId,
				patientId: input.patientId,
				encounterId: encounter.id,
				origin: card?.origin,
			});
			return toEncounter(encounter);
		});
	}
}

export function toEncounter(row: EncounterRow): Encounter {
	return {
		id: row.id,
		patientId: row.patientId,
		reason: row.reason,
		notes: row.notes,
		history: row.history,
		physicalExam: row.physicalExam,
		assessment: row.assessment,
		plan: row.plan,
		patientInstructions: row.patientInstructions,
		followUpOn: row.followUpOn?.toISOString().slice(0, 10) ?? null,
		startedAt: row.startedAt,
		sourceChatId: row.sourceChatId,
		version: row.version,
		orgId: row.orgId,
		doctorId: row.doctorId,
	};
}
