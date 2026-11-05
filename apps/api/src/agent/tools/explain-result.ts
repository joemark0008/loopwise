import { explainResult } from '@loopwise/shared/tools';

import { createTool } from '../utils/tools.js';

/**
 * Explains a result for Wise (DESIGN.md §4.4 "rules-first decisions", §7.2): the deterministic evaluation of the rules
 * engine, read as the signed-in user (row-level security, audited). Wise relays the rule; it never decides. Reads only.
 */
export default createTool<explainResult.Input, explainResult.Output>({
	kind: 'read',
	description: explainResult.description,
	inputSchema: explainResult.InputSchema,
	outputSchema: explainResult.OutputSchema,
	execute: async ({ resultId }, context) => ({
		_version: '1' as const,
		...(await context.services.rules.explainForWise(context.userId, resultId.trim())),
	}),
});
