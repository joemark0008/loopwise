import { findStock } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `find_stock` (DESIGN.md §7.2): stock of a medicine or supply at the chat's clinic, lot by lot first expiry first,
 * read as the user (pharmacy and stock-room staff) and audited. Stock is never changed from chat.
 */
export default createTool<findStock.Input, findStock.Output>({
	kind: 'read',
	description: findStock.description,
	inputSchema: findStock.InputSchema,
	outputSchema: findStock.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.inventory.stockForWise(context.userId, context.clinicId, {
			...input,
			limit: findStock.MAX_ITEMS,
		})),
	}),
});
