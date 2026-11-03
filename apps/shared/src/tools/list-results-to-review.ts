import z from 'zod/v3';

export const MAX_RESULTS = 20;

export const description = [
	'List the results waiting for the clinician to review, read as them: critical first, then abnormal, reports to read',
	'and normal. Each comes with its value, unit and reference range, the lab, and the rules-engine evaluation (pathway,',
	'classification, reason, next step) when there is one. In a patient chart chat it lists only that patient.',
	"When you discuss a result, cite its value and range and the evaluation's reason; never diagnose. To mark one",
	'reviewed, call propose_result_review with its id. Critical results: tell the clinician to act now.',
].join(' ');

export const InputSchema = z.object({
	urgency: z
		.enum(['critical', 'abnormal', 'normal', 'unflagged'])
		.optional()
		.describe('Only results of this urgency, if the clinician asked for it.'),
});

export const EvaluationSchema = z.object({
	pathwayName: z.string(),
	classification: z.enum(['normal', 'actionable', 'critical']),
	urgency: z.string(),
	reason: z.string(),
	guideline: z.string(),
	slaHours: z.number().nullable(),
});

export const ResultSchema = z.object({
	id: z.string(),
	test: z.string(),
	value: z.string(),
	unit: z.string().nullable(),
	refRange: z.string().nullable(),
	flag: z.string().nullable(),
	urgency: z.enum(['critical', 'abnormal', 'normal', 'unflagged']),
	resultedAt: z.string(),
	patient: z.object({ id: z.string(), name: z.string(), birthDate: z.string() }),
	lab: z.string(),
	evaluation: EvaluationSchema.nullable(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	results: z.array(ResultSchema),
	/** More results are waiting than were returned. */
	truncated: z.boolean(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Result = z.infer<typeof ResultSchema>;
