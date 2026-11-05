import { listLabOrders } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_lab_orders` (DESIGN.md §7.3): the lab worklist of the chat's clinic, read as the user (lab staff of that
 * clinic only; row-level security on top). Moving a test is `propose_lab_order_step`, which only the user's Confirm
 * saves.
 */
export default createTool<listLabOrders.Input, listLabOrders.Output>({
	kind: 'read',
	description: listLabOrders.description,
	inputSchema: listLabOrders.InputSchema,
	outputSchema: listLabOrders.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.diagnostics.labWorklistForWise(context.userId, context.clinicId, {
			statuses: input.status ? [input.status] : [...listLabOrders.LAB_WORKLIST_STATUSES],
			limit: listLabOrders.MAX_ORDERS,
		})),
	}),
});
