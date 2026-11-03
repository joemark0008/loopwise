import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateSkillInput {
	@Field()
	name: string;

	@Field()
	description: string;

	@Field()
	body: string;
}

@InputType()
export class UpdateSkillInput {
	@Field()
	name: string;

	@Field()
	description: string;

	@Field()
	body: string;

	@Field({ description: 'Hash from `skillDetail`, so an edit never overwrites a newer version of the file.' })
	expectedHash: string;
}

@InputType()
export class DeleteSkillInput {
	@Field()
	name: string;

	@Field()
	expectedHash: string;
}
