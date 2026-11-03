import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { WiseProposalOutcome as WiseProposalOutcomeRow } from '../../../generated/prisma/client.js';

/** How a Wise proposal card ended; a card with an outcome is settled and can't be confirmed again. */
@ObjectType()
export class WiseProposalOutcome {
	@Field(() => ID)
	toolCallId: string;

	@Field()
	toolName: string;

	@Field({ description: '`confirmed` or `cancelled`.' })
	status: string;

	@Field(() => String, { nullable: true })
	resourceId: string | null;
}

export function toWiseProposalOutcome(row: WiseProposalOutcomeRow): WiseProposalOutcome {
	return { toolCallId: row.toolCallId, toolName: row.toolName, status: row.status, resourceId: row.resourceId };
}
