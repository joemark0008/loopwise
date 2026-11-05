import { chartPatientTrend, clinicalChart } from '@loopwise/shared/tools';

import { createTool, rememberToolOutput, withResultId } from '../utils/tools.js';

/**
 * Charts one patient's vitals or lab results for Wise (DESIGN.md §7.2), read as the signed-in user and audited. Wise
 * picks the measure; the points come from the record, and the model gets them back to describe the trend.
 */
export default createTool<chartPatientTrend.Input, chartPatientTrend.Output>({
	kind: 'read',
	description: chartPatientTrend.description,
	inputSchema: chartPatientTrend.InputSchema,
	outputSchema: chartPatientTrend.OutputSchema,
	execute: async ({ measure, patientId, months }, context, { toolCallId }) => {
		const id = patientId?.trim() || context.patientId;
		if (!id) {
			throw new Error('Which patient? Use find_patient and pass the id it returned.');
		}
		const output = await context.services.insights.patientTrend(context.userId, id, measure, months);
		if (!output) {
			throw new Error('Patient not found. Use find_patient and only ids it returned; never guess.');
		}
		return rememberToolOutput(context, toolCallId, 'chart_patient_trend', output);
	},
	toModelOutput: ({ toolCallId, output }) => ({
		type: 'text',
		value: withResultId(
			toolCallId,
			['chart'],
			output.chart.rows.length === 0
				? `No ${chartPatientTrend.MEASURE_LABELS[output.measure]} recorded for ${output.patient.name} in the last ${output.months} months. An empty chart is shown.`
				: `${output.chart.title} chart of ${output.patient.name} (last ${output.months} months, ${output.chart.unit}) shown to the user. Points:\n${clinicalChart.summarizeRows(output.chart)}`,
		),
	}),
});
