import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A project skill: a Markdown playbook in `agent/skills/`.' })
export class Skill {
	@Field()
	name: string;

	@Field()
	description: string;

	@Field({ description: 'Project path of the skill file, e.g. `/agent/skills/churn.md`.' })
	location: string;
}

@ObjectType({ description: 'A skill file that could not be loaded.' })
export class SkillLoadError {
	@Field()
	location: string;

	@Field()
	message: string;
}

@ObjectType({ description: 'How this project saves skills written in the app.' })
export class SkillSaveStatus {
	@Field({ description: '`direct` or `disabled`.' })
	mode: string;

	@Field(() => String, { nullable: true, description: 'Why saving is blocked, when `disabled`.' })
	message: string | null;
}

@ObjectType({ description: 'A skill with its instructions, for editing.' })
export class SkillDetail {
	@Field()
	name: string;

	@Field()
	description: string;

	@Field()
	body: string;

	@Field()
	hash: string;
}

@ObjectType()
export class CreatedSkill {
	@Field()
	name: string;

	@Field()
	location: string;
}

@ObjectType()
export class UpdatedSkill {
	@Field()
	name: string;

	@Field()
	hash: string;
}
