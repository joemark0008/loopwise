import { listBilling } from '@loopwise/shared/tools';

import type { ToolContext } from '../types/tools.js';
import { createTool } from '../utils/tools.js';

/**
 * `list_billing` (DESIGN.md §7.2): the cashier desk at the chat's clinic, read as the user and audited — a day's
 * collections by method, the open invoices (of the chart's patient, else the clinic's) or the user's shift. Payments,
 * issuing, voids and closing a shift happen on the cashier pages, never from chat.
 */
export default createTool<listBilling.Input, listBilling.Output>({
	kind: 'read',
	description: listBilling.description,
	inputSchema: listBilling.InputSchema,
	outputSchema: listBilling.OutputSchema,
	execute: async (input, context: ToolContext) => ({
		_version: '1' as const,
		...(await context.services.billing.forWise(context.userId, context.clinicId, {
			...input,
			chartPatientId: context.patientId ?? null,
		})),
	}),
});
