import z from 'zod/v3';

import { CASE_STATES, RESULT_CLASSIFICATIONS, URGENCIES } from '../pathway-rules';

export const description = [
	'Explain why a lab or imaging result is normal, actionable or critical, from the deterministic rules engine:',
	'the pathway, the rule (threshold or code) that matched, the guideline it cites, the urgency and the next step.',
	'Use it whenever the user asks why a result was flagged, how urgent it is or what should happen next; pass the',
	'result id from the patient record ([result <id>]). Quote the reason and the guideline as returned. You never',
	'decide the classification yourself: if the tool says no pathway applies or the rule could not read the value,',
	'say so and leave the judgement to the clinician. A critical value means the clinician acts now; never draft a',
	'patient message for it. Every call is recorded in the audit log.',
].join(' ');

export const InputSchema = z.object({
	resultId: z.string().min(1).describe('The id of the result, as shown in the patient record ([result <id>]).'),
});

export const EvaluationSchema = z.object({
	pathwayKey: z.string(),
	pathwayName: z.string(),
	ruleVersion: z.number(),
	classification: z.enum(RESULT_CLASSIFICATIONS),
	urgency: z.enum(URGENCIES),
	reason: z.string(),
	guideline: z.string(),
	nextState: z.enum(CASE_STATES),
	slaHours: z.number().nullable(),
	/** `band`, `critical_flag` (the lab's flag raised it) or `unrecognised` (review by hand). */
	basis: z.enum(['band', 'critical_flag', 'unrecognised']),
	rule: z.object({
		code: z.string(),
		display: z.string(),
		band: z.string().nullable(),
		comparedValue: z.number().nullable(),
		comparedUnit: z.string().nullable(),
		received: z.string(),
	}),
	/** False when no evaluation was stored yet and this one was computed for the answer, by the same engine. */
	stored: z.boolean(),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	result: z.object({
		id: z.string(),
		patientId: z.string(),
		display: z.string(),
		value: z.string(),
		unit: z.string().nullable(),
		flag: z.string().nullable(),
		resultedAt: z.string(),
	}),
	/** Null when no pathway applies to this result's code. */
	evaluation: EvaluationSchema.nullable(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
