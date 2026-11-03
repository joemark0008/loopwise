import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { IsSignInEmail, normalizeEmail, trim } from '../../common/validators/auth-input.validators.js';
import { ORG_ROLES, type OrgRole } from '../../organizations/organization.repository.js';

@InputType()
export class CreateUserInput {
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

	@Field(() => String, { description: 'admin, user or viewer.' })
	@IsIn(ORG_ROLES)
	role: OrgRole;
}
