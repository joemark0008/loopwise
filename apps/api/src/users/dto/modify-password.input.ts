import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class ModifyPasswordInput {
	@Field()
	@IsString()
	newPassword: string;

	@Field()
	@IsString()
	confirmPassword: string;
}
