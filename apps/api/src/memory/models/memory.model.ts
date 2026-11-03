import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'A memory the agent extracted from (or the user edited after) a conversation.' })
export class Memory {
	@Field(() => ID)
	id: string;

	@Field(() => String, { nullable: true })
	chatId: string | null;

	@Field()
	content: string;

	@Field({ description: '`global_rule` (an instruction) or `personal_fact` (about the user).' })
	category: string;

	@Field(() => String, { nullable: true })
	supersededBy: string | null;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}

@ObjectType()
export class MemorySettings {
	@Field()
	memoryEnabled: boolean;
}
