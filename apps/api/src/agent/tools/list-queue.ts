import { listQueue } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_queue` (DESIGN.md §7.2): "who's next" at the chat's clinic today, read as the user and audited, in call order
 * (the priority lane first). Calling, sending on and checking in happen on the queue pages, never from chat.
 */
export default createTool<listQueue.Input, listQueue.Output>({
	kind: 'read',
	description: listQueue.description,
	inputSchema: listQueue.InputSchema,
	outputSchema: listQueue.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.scheduling.queueForWise(context.userId, context.clinicId, input)),
	}),
});
