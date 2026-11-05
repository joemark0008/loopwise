import { listAppointments } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_appointments` (DESIGN.md §7.2): a day's appointments at the chat's clinic, read as the user (row-level
 * security picks the patients) and audited; in a chart chat, the patient's own unless the user asks for the whole day.
 * Booking and moving one are `propose_appointment` / `propose_reschedule`, which only the user's Confirm saves.
 */
export default createTool<listAppointments.Input, listAppointments.Output>({
	kind: 'read',
	description: listAppointments.description,
	inputSchema: listAppointments.InputSchema,
	outputSchema: listAppointments.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.scheduling.appointmentsForWise(context.userId, context.clinicId, {
			...input,
			patientId: context.patientId ?? null,
			limit: listAppointments.MAX_APPOINTMENTS,
		})),
	}),
});
