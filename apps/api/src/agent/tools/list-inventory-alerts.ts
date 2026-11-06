import { listInventoryAlerts } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_inventory_alerts` (DESIGN.md §7.2): low stock, lots expiring within a window and expired lots at the chat's
 * clinic, read as the user (pharmacy and stock-room staff) and audited. Disposing and reordering happen on the
 * Pharmacy pages, never from chat.
 */
export default createTool<listInventoryAlerts.Input, listInventoryAlerts.Output>({
	kind: 'read',
	description: listInventoryAlerts.description,
	inputSchema: listInventoryAlerts.InputSchema,
	outputSchema: listInventoryAlerts.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.inventory.alertsForWise(context.userId, context.clinicId, {
			...input,
			limit: listInventoryAlerts.MAX_ROWS,
		})),
	}),
});
