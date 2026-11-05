import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { WiseProposalOutcome as WiseProposalOutcomeRow } from '../../../generated/prisma/client.js';

/** How a Wise proposal card ended; a card with an outcome is settled and can't be confirmed again. */
@ObjectType()
export class WiseProposalOutcome {
	@Field(() => ID, { description: 'The tool call; `<toolCallId>#<part>` for a part of a scribe draft.' })
	toolCallId: string;

	@Field()
	toolName: string;

	@Field({ description: '`confirmed` or `cancelled`.' })
	status: string;

	@Field(() => String, { nullable: true, description: 'The record the card was confirmed into (`entity_id`).' })
	resourceId: string | null;

	@Field({ description: "Whether the clinician changed Wise's draft before confirming it." })
	edited: boolean;
}

export function toWiseProposalOutcome(row: WiseProposalOutcomeRow): WiseProposalOutcome {
	return {
		toolCallId: row.toolCallId,
		toolName: row.toolName,
		status: row.status,
		resourceId: row.entityId,
		edited: row.edited,
	};
}
