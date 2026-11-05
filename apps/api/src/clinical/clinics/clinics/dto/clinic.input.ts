import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateClinicInput {
	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;
}

@InputType()
export class RenameClinicInput {
	@Field(() => ID)
	@IsString()
	clinicId: string;

	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;
}

@InputType()
export class SavedPromptInput {
	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title: string;

	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(10_000)
	prompt: string;
}

@InputType()
export class UpdateSavedPromptInput {
	@Field(() => ID)
	@IsString()
	promptId: string;

	@Field({ nullable: true })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title?: string;

	@Field({ nullable: true })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(10_000)
	prompt?: string;
}
