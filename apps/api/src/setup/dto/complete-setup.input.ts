import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

import {
	IsSignInEmail,
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH,
	normalizeEmail,
	trim,
} from '../../common/validators/auth-input.validators.js';

@InputType()
export class CompleteSetupInput {
	@Field()
	@IsString()
	token: string;

	@Field()
	@Transform(trim)
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;

	@Field()
	@Transform(normalizeEmail)
	@IsSignInEmail()
	email: string;

	@Field()
	@IsString()
	@MinLength(MIN_PASSWORD_LENGTH)
	@MaxLength(MAX_PASSWORD_LENGTH)
	password: string;
}
