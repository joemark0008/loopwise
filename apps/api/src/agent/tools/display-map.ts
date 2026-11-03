import type { CustomBoundarySet } from '@quarry/shared';
import { displayMap } from '@quarry/shared/tools';

import { getQueryResult } from '../services/query-result.service.js';
import { DisplayMapOutput, renderToModelOutput } from '../tool-outputs/index.js';
import { validateMapConfig } from '../utils/display-map-validate.js';
import { createTool } from '../utils/tools.js';

export function createDisplayMapTool(customSets: CustomBoundarySet[] = []) {
	return createTool<displayMap.Input, displayMap.Output>({
		kind: 'display',
		description: 'Display an interactive map of geographic data from a previous `execute_sql` tool call.',
		inputSchema: displayMap.buildInputSchema(customSets),
		outputSchema: displayMap.OutputSchema,

		execute: async (input, context) => {
			const queryResult = await getQueryResult(context, input.query_id);
			if (!queryResult) {
				return {
					_version: '1',
					success: false,
					error: `Query result "${input.query_id}" not found. Run \`execute_sql\` first and use the id from its output.`,
				};
			}

			const result = await validateMapConfig(input, queryResult);
			if (result.success) {
				context.generatedArtifacts.maps.push(input);
			}
			return result;
		},

		toModelOutput: ({ output }) => renderToModelOutput(DisplayMapOutput({ output }), output),
	});
}
