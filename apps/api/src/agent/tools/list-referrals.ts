import { listReferrals } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_referrals` (DESIGN.md §6, §7.2): the user's referrals, sent to them (inbox) or by them (outbox), pending by
 * default, read as the user and audited. Answering one is the Referrals page's dialog, never from chat.
 */
export default createTool<listReferrals.Input, listReferrals.Output>({
	kind: 'read',
	description: listReferrals.description,
	inputSchema: listReferrals.InputSchema,
	outputSchema: listReferrals.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.followUps.referralsForWise(context.userId, {
			...input,
			limit: listReferrals.MAX_REFERRALS,
		})),
	}),
});
