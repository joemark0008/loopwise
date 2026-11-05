import type { WiseActionMutation } from '@loopwise/shared/wise-actions';
import { Injectable } from '@nestjs/common';

import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import {
	assertCardPatient,
	type VerifiedWiseCard,
	type WiseOrigin,
	WiseProposalService,
} from '../wise-proposals/wise-proposal.service.js';
import type { EncounterContext } from './encounter.service.js';

/** The Wise card behind a write to an encounter's record. */
export interface EncounterCard {
	/** What the audit row records. */
	origin?: WiseOrigin;
	/** The card to settle with the write (absent for a follow-up of a card already settled). */
	card?: VerifiedWiseCard;
}

/**
 * Verifies the Wise card behind a write to an encounter's record, once the encounter is read: a follow-up of a
 * confirmed `propose_encounter` (the vitals and diagnoses it drafted, written after the encounter exists: its origin
 * only, it is settled already), or a Wise action card for `mutation`, checked against the tool settings of the visit's
 * organization and its patient, which the caller settles in its transaction.
 */
@Injectable()
export class EncounterCardService {
	constructor(private readonly wiseProposals: WiseProposalService) {}

	async verify(
		userId: string,
		wiseOrigin: WiseOriginInput | null | undefined,
		encounter: EncounterContext,
		mutation: WiseActionMutation,
	): Promise<EncounterCard> {
		if (!wiseOrigin) {
			return {};
		}
		if (wiseOrigin.toolName === 'propose_encounter') {
			const origin = await this.wiseProposals.verifyFollowUp(userId, wiseOrigin, {
				toolNames: ['propose_encounter'],
				entityId: encounter.id,
			});
			return { origin };
		}
		const card = await this.wiseProposals.verifyAction(userId, wiseOrigin, mutation, encounter.organizationId);
		assertCardPatient(card, encounter.patientId);
		return { origin: card?.origin, card };
	}
}
