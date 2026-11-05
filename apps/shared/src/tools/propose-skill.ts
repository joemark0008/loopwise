import z from 'zod/v3';

import { SkillDraftSchema } from '../skill-authoring';

export const description = [
	'Show the user a draft of a new clinic skill, in a card where they can edit, save or discard it.',
	'Use this as your final step when the user asks to create a skill. Load the skill-creator skill first.',
	'This saves nothing: only the user can save the draft, so never say the skill is saved until they tell you it is.',
	'Never call this tool together with another tool.',
].join(' ');

export const InputSchema = SkillDraftSchema;

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
