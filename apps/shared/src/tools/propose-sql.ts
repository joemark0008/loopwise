import z from 'zod/v3';

export const description = [
	'Show the user a SQL query they can apply to the query editor. Use this as your final step instead of pasting the query into your answer.',
	'Run the exact SQL with execute_sql in this same turn first and fix any error, so the user sees it as tested.',
	'This does not change the editor or save anything: the user decides whether to apply it.',
	'Never call this tool together with another tool.',
].join(' ');

export const InputSchema = z.object({
	sql: z.string().min(1).describe('The complete SQL query, exactly as it should go into the editor.'),
	database_id: z.string().optional().describe('The connection the query was written for, if not the default.'),
	summary: z.string().min(1).describe('One short sentence on what the query returns.'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	tested: z.boolean().describe('True only if this exact SQL ran successfully on the warehouse in this turn.'),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
