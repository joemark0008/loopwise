import z from 'zod/v3';

export const MAX_RESULTS = 20;

export const RESULT_URGENCIES = ['critical', 'abnormal', 'normal', 'unflagged'] as const;
export type ResultUrgency = (typeof RESULT_URGENCIES)[number];

export const description = [
	'List the released lab and imaging results waiting for the clinician to review, read as them: critical first,',
	'then abnormal, reports to read and normal. Each comes with its values, units, reference ranges and flags (computed',
	"by the lab from the test's reference range), or the findings and impression of an imaging report. In a patient",
	'chart chat it lists only that patient. When you discuss a result, cite its value, range and flag; never diagnose.',
	'To mark one reviewed, call propose_result_review with its id. Critical values: tell the clinician to act now, and',
	'never draft an automated patient message for them.',
].join(' ');

export const InputSchema = z.object({
	urgency: z
		.enum(RESULT_URGENCIES)
		.optional()
		.describe('Only results of this urgency, if the clinician asked for it.'),
});

export const ValueSchema = z.object({
	name: z.string(),
	value: z.string(),
	unit: z.string().nullable(),
	referenceRange: z.string().nullable(),
	flag: z.string().nullable(),
});

export const ResultSchema = z.object({
	id: z.string(),
	test: z.string(),
	orderNo: z.string(),
	values: z.array(ValueSchema),
	findings: z.string().nullable(),
	impression: z.string().nullable(),
	urgency: z.enum(RESULT_URGENCIES),
	releasedAt: z.string().nullable(),
	patient: z.object({ id: z.string(), name: z.string(), birthDate: z.string() }),
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
export type Value = z.infer<typeof ValueSchema>;
