import { listLabOrders } from '@quarry/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_lab_orders` (DESIGN.md §9.4): the receiving facility's worklist, read as the user (row-level security and the
 * facility check in `OrderService`). Moving an order is `propose_lab_order_step`, which only the user's Confirm saves.
 */
export default createTool<listLabOrders.Input, listLabOrders.Output>({
	kind: 'read',
	description: listLabOrders.description,
	inputSchema: listLabOrders.InputSchema,
	outputSchema: listLabOrders.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.orders.labOrdersForWise(context.userId, {
			statuses: input.status ? [input.status] : [...listLabOrders.LAB_WORKLIST_STATUSES],
			limit: listLabOrders.MAX_ORDERS,
		})),
	}),
});
