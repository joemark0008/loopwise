import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { RecordScribeConsentInput } from './dto/scribe.input.js';
import { RecordingConsent } from './models/recording-consent.model.js';
import { ScribeConsentService } from './scribe-consent.service.js';

/** The AI scribe's recording consent per visit. Drafting is Wise's `propose_scribe_note`; confirming, each card's own mutation. */
@Resolver(() => RecordingConsent)
export class ScribeResolver {
	constructor(private readonly consents: ScribeConsentService) {}

	@Query(() => RecordingConsent, {
		nullable: true,
		description: "The visit's latest answer to recording for the AI scribe; null when the patient wasn't asked.",
	})
	scribeConsent(
		@CurrentUser() user: AuthUser,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<RecordingConsent | null> {
		return this.consents.forEncounter(user.id, encounterId);
	}

	@Mutation(() => RecordingConsent, {
		description: "Records the patient's answer to recording this visit (granted, refused or withdrawn).",
	})
	recordScribeConsent(
		@CurrentUser() user: AuthUser,
		@Args('input') input: RecordScribeConsentInput,
	): Promise<RecordingConsent> {
		return this.consents.record(user.id, input);
	}
}
