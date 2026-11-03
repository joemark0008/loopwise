import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../common/validators/auth-input.validators.js';

@InputType()
export class ChangePasswordInput {
	@Field()
	@IsString()
	@MaxLength(MAX_PASSWORD_LENGTH)
	currentPassword: string;

	@Field()
	@IsString()
	@MinLength(MIN_PASSWORD_LENGTH)
	@MaxLength(MAX_PASSWORD_LENGTH)
	newPassword: string;
}
