import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class EditMemoryInput {
	@Field(() => ID)
	@IsString()
	memoryId: string;

	@Field()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@MinLength(1)
	@MaxLength(1000)
	content: string;
}
