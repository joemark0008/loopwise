import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { WiseOriginInput } from './dto/wise-origin.input.js';
import { WiseProposalOutcome } from './models/wise-proposal-outcome.model.js';
import { WiseProposalService } from './wise-proposal.service.js';

/** Outcomes of the Wise proposal cards of the user's own chats. Confirming happens in each feature's mutation. */
@Resolver(() => WiseProposalOutcome)
export class WiseProposalsResolver {
	constructor(private readonly service: WiseProposalService) {}

	@Query(() => [WiseProposalOutcome], { description: 'The settled Wise cards of one of your chats.' })
	wiseProposalOutcomes(
		@CurrentUser() user: AuthUser,
		@Args('chatId', { type: () => ID }) chatId: string,
	): Promise<WiseProposalOutcome[]> {
		return this.service.outcomes(user.id, chatId);
	}

	@Mutation(() => WiseProposalOutcome, { description: 'Cancels a Wise card, so it can no longer be confirmed.' })
	cancelWiseProposal(
		@CurrentUser() user: AuthUser,
		@Args('input') input: WiseOriginInput,
	): Promise<WiseProposalOutcome> {
		return this.service.cancel(user.id, input);
	}
}
