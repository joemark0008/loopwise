import { describeAnalytics } from '@loopwise/shared/tools';

import { createTool } from '../utils/tools.js';

/** The analytics views Wise may query and the certified metrics (DESIGN.md §9.2). Reads the schema only. */
export default createTool<describeAnalytics.Input, describeAnalytics.Output>({
	kind: 'read',
	description: describeAnalytics.description,
	inputSchema: describeAnalytics.InputSchema,
	outputSchema: describeAnalytics.OutputSchema,
	execute: async (_input, context) => ({ _version: '1' as const, ...(await context.services.analytics.describe()) }),
	toModelOutput: ({ output }) => ({
		type: 'text',
		value: [
			'Analytics views (schema analytics; reference them unqualified):',
			...output.views.map(
				(view) =>
					`- ${view.name}: ${view.description}\n${view.columns.map((column) => `    ${column.name} ${column.type}${column.description ? ` — ${column.description}` : ''}`).join('\n')}`,
			),
			'Certified metrics (get_metric):',
			...output.metrics.map((metric) => `- ${metric.name}: ${metric.definition}`),
		].join('\n'),
	}),
});
