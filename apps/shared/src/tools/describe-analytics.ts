import z from 'zod/v3';

export const description = [
	"List the analytics views of the user's own patients, their columns with meanings, and the certified metrics.",
	'Call it before writing SQL for run_analytics_sql.',
].join(' ');

export const InputSchema = z.object({});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	views: z.array(
		z.object({
			name: z.string(),
			description: z.string(),
			columns: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
		}),
	),
	metrics: z.array(z.object({ name: z.string(), label: z.string(), definition: z.string() })),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
