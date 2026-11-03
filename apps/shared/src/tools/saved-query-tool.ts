import z from 'zod/v3';

import { OutputSchema as ExecuteSqlOutputSchema } from './execute-sql';

/** Which saved tool produced a result, and the SQL it ran with the arguments written in. */
export const QueryToolRunSchema = z.object({
	tool_id: z.string(),
	name: z.string(),
	sql_query: z.string(),
	database_id: z.string().optional(),
});

/** Output of a `qt_<name>` tool: an `execute_sql` result plus the saved tool's run. */
export const OutputSchema = ExecuteSqlOutputSchema.extend({
	query_tool: QueryToolRunSchema,
});

export type QueryToolRun = z.infer<typeof QueryToolRunSchema>;
export type Output = z.infer<typeof OutputSchema>;
