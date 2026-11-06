import { listFollowUps } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_follow_ups` (DESIGN.md §6, §7.2): the follow-ups overdue, due or coming up at the chat's clinic, read as the
 * user and audited; in a chart chat, that patient's. Booking one is `propose_appointment`, which only the user's
 * Confirm saves; nothing messages the patient.
 */
export default createTool<listFollowUps.Input, listFollowUps.Output>({
	kind: 'read',
	description: listFollowUps.description,
	inputSchema: listFollowUps.InputSchema,
	outputSchema: listFollowUps.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.followUps.followUpsForWise(context.userId, context.clinicId, {
			...input,
			patientId: context.patientId ?? null,
			limit: listFollowUps.MAX_FOLLOW_UPS,
		})),
	}),
});
