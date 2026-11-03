import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateProfileInput {
	@Field()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;
}
