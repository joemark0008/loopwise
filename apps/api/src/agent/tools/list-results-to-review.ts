import { listResultsToReview } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_results_to_review` (DESIGN.md §7.2, §7.3): the clinician's results inbox, read as them (row-level security),
 * with the rules engine's stored evaluation of each result; in a chart chat, that patient's only. Audited by the
 * service. To mark one reviewed Wise calls `propose_result_review`, whose card only the clinician confirms.
 */
export default createTool<listResultsToReview.Input, listResultsToReview.Output>({
	kind: 'read',
	description: listResultsToReview.description,
	inputSchema: listResultsToReview.InputSchema,
	outputSchema: listResultsToReview.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.results.toReviewForWise(context.userId, {
			patientId: context.patientId,
			urgency: input.urgency,
			limit: listResultsToReview.MAX_RESULTS,
		})),
	}),
});
