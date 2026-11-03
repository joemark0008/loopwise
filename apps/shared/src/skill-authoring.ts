import z from 'zod/v3';

/** Project skills written from the app or drafted in chat: one Markdown file per skill in `agent/skills/`. */
export const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const SKILL_BODY_MAX_LENGTH = 1_000_000;

export const SkillDraftSchema = z.object({
	name: z
		.string()
		.regex(SKILL_NAME_PATTERN, 'Use lowercase letters, numbers and hyphens, up to 63 characters.')
		.describe('Short kebab-case name, e.g. churn-analysis.'),
	description: z
		.string()
		.trim()
		.min(1, 'Add a description.')
		.max(SKILL_DESCRIPTION_MAX_LENGTH)
		.describe('When to use the skill. This decides whether the agent loads it, so name the questions it covers.'),
	body: z
		.string()
		.trim()
		.min(1, 'Add the instructions.')
		.max(SKILL_BODY_MAX_LENGTH)
		.describe('The instructions, in Markdown.'),
});

export type SkillDraft = z.infer<typeof SkillDraftSchema>;

export const skillFilePath = (name: string): string => `/agent/skills/${name}.md`;

export const SKILL_SAVE_MODES = ['direct', 'disabled'] as const;
export type SkillSaveMode = (typeof SKILL_SAVE_MODES)[number];
