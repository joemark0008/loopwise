import { runAnalyticsSql } from '@loopwise/shared/tools';

import { createTool, rememberToolOutput, withResultId } from '../utils/tools.js';

/**
 * Runs Wise's SQL over the analytics views, as the user (DESIGN.md §7.2, §8.2): validated, then run read-only on the
 * analyst role, which Postgres limits to the user's own patients. The model gets a sample; the card shows the table.
 */
export default createTool<runAnalyticsSql.Input, runAnalyticsSql.Output>({
	kind: 'read',
	description: runAnalyticsSql.description,
	inputSchema: runAnalyticsSql.InputSchema,
	outputSchema: runAnalyticsSql.OutputSchema,
	execute: async (input, context, { toolCallId }) =>
		rememberToolOutput(context, toolCallId, 'run_analytics_sql', {
			_version: '1' as const,
			...(await context.services.analytics.run(context.userId, input, {
				chatId: context.chatId,
				toolCallId,
				tool: 'run_analytics_sql',
			})),
		}),
	toModelOutput: ({ toolCallId, output }) => ({
		type: 'text',
		value: withResultId(
			toolCallId,
			['table', 'chart'],
			[
				`${output.rowCount} row${output.rowCount === 1 ? '' : 's'}${output.truncated ? ` (capped at ${runAnalyticsSql.MAX_ROWS})` : ''}; the user sees the table and can view the query.`,
				output.chart ? `Drawn for the user as a ${output.chart.type.replace('_', ' ')} chart.` : '',
				output.suppressed
					? 'Counts under 5 are shown as "<5" (small-cell suppression); never estimate them.'
					: '',
				sampleTable(output.columns, output.rows),
			]
				.filter(Boolean)
				.join('\n'),
		),
	}),
});

/** The first rows as a Markdown table, for the model. */
export function sampleTable(columns: string[], rows: runAnalyticsSql.Cell[][]): string {
	const sample = rows.slice(0, runAnalyticsSql.SAMPLE_ROWS);
	const lines = [`| ${columns.join(' | ')} |`, `| ${columns.map(() => '---').join(' | ')} |`];
	lines.push(...sample.map((row) => `| ${row.map((cell) => (cell === null ? '' : String(cell))).join(' | ')} |`));
	if (rows.length > sample.length) {
		lines.push(`(${rows.length - sample.length} more rows not shown to you)`);
	}
	return lines.join('\n');
}
