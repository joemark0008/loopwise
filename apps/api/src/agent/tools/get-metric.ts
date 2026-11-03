import { getMetric } from '@loopwise/shared/tools';

import { createTool, rememberToolOutput, withResultId } from '../utils/tools.js';
import { sampleTable } from './run-analytics-sql.js';

/** A certified metric of the user's own patients (DESIGN.md §12): one fixed definition, run on the analyst role. */
export default createTool<getMetric.Input, getMetric.Output>({
	kind: 'read',
	description: getMetric.description,
	inputSchema: getMetric.InputSchema,
	outputSchema: getMetric.OutputSchema,
	execute: async (input, context, { toolCallId }) =>
		rememberToolOutput(context, toolCallId, 'get_metric', {
			_version: '1' as const,
			...(await context.services.analytics.metric(context.userId, input, {
				chatId: context.chatId,
				toolCallId,
				tool: 'get_metric',
			})),
		}),
	toModelOutput: ({ toolCallId, output }) => ({
		type: 'text',
		value: withResultId(
			toolCallId,
			['table', 'chart'],
			[
				`${output.label} (${output.definition}${output.months ? ` Period: last ${output.months} months.` : ''}) Shown to the user.`,
				output.chart ? `Drawn for the user as a ${output.chart.type.replace('_', ' ')} chart.` : '',
				output.suppressed ? 'Counts under 5 are shown as "<5"; never estimate them.' : '',
				sampleTable(output.columns, output.rows),
			]
				.filter(Boolean)
				.join('\n'),
		),
	}),
});
