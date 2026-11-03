import { chartFacilityPanel, clinicalChart } from '@quarry/shared/tools';

import { createTool, rememberToolOutput, withResultId } from '../utils/tools.js';

/**
 * Charts counts across the user's facility for Wise (DESIGN.md §9.2): encounters, diagnoses by ICD-10 chapter, open
 * orders and results awaiting review, from the patients they may see, audited. Counts only, never names. Program
 * metrics (§12) belong to the dashboard.
 */
export default createTool<chartFacilityPanel.Input, chartFacilityPanel.Output>({
	kind: 'read',
	description: chartFacilityPanel.description,
	inputSchema: chartFacilityPanel.InputSchema,
	outputSchema: chartFacilityPanel.OutputSchema,
	execute: async ({ metric, facilityId, months }, context, { toolCallId }) =>
		rememberToolOutput(
			context,
			toolCallId,
			'chart_facility_panel',
			await context.services.insights.facilityPanel(
				context.userId,
				metric,
				facilityId?.trim() || undefined,
				months,
			),
		),
	toModelOutput: ({ toolCallId, output }) => ({
		type: 'text',
		value: withResultId(
			toolCallId,
			['chart'],
			`${output.chart.title} at ${output.facility.name} (last ${output.months} months) shown to the user. Counts:\n${clinicalChart.summarizeRows(output.chart)}`,
		),
	}),
});
