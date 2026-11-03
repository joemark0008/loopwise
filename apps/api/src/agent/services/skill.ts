/** Project skill types of upstream `services/skill.ts` (the `skills` module is Phase 3). */
export interface Skill {
	name: string;
	description: string;
	location: string;
}

export interface PreloadedSkill extends Skill {
	content: string;
}
