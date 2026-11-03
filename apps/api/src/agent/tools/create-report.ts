import { createReport } from '@quarry/shared/tools';

import { createTool, rememberToolOutput, withResultId } from '../utils/tools.js';

/**
 * Builds a summary report for Wise (DESIGN.md §9.2): the server fills the data sections as the signed-in user and
 * freezes them in the tool output, which the PDF is printed from. The model writes only the narrative, and a narrative
 * with a number the sections don't hold is refused. Viewing a report is a read; the PDF is the clinician's click.
 */
export default createTool<createReport.Input, createReport.Output>({
	kind: 'read',
	description: createReport.description,
	inputSchema: createReport.InputSchema,
	outputSchema: createReport.OutputSchema,
	execute: async (input, context, { toolCallId }) => {
		const patientId = input.patientId?.trim() || context.patientId;
		const narrative = input.narrative.trim();
		const snapshot = await context.services.insights.buildReport(context.userId, {
			type: input.type,
			patientId,
			encounterId: input.encounterId,
			facilityId: input.facilityId,
			months: input.months,
			charts: input.charts,
			narrative,
			reportId: toolCallId,
		});
		return rememberToolOutput(context, toolCallId, 'create_report', {
			_version: '1' as const,
			snapshot,
			narrative,
		});
	},
	toModelOutput: ({ toolCallId, output }) => ({
		type: 'text',
		value: withResultId(
			toolCallId,
			['sections'],
			`${output.snapshot.title} of ${output.snapshot.subject} shown to the clinician with a Download PDF button. Nothing is saved or sent. Do not repeat the report; reply in one line.`,
		),
	}),
});
