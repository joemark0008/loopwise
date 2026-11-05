import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { StaffRole } from '../../clinics/models/clinic-enums.js';
import { IsSignInEmail, normalizeEmail, trim } from '../../common/validators/auth-input.validators.js';

/** The organization access levels the users page offers; stored as `OrgRole` ADMIN / MEMBER / VIEWER. */
export const ORG_ACCESS_LEVELS = ['admin', 'user', 'viewer'] as const;
export type OrgAccessLevel = (typeof ORG_ACCESS_LEVELS)[number];

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

	@Field(() => String, {
		description: 'Organization access level: admin, user or viewer (OrgRole ADMIN / MEMBER / VIEWER).',
	})
	@IsIn(ORG_ACCESS_LEVELS)
	role: OrgAccessLevel;

	@Field(() => [StaffRole], { nullable: true, description: 'Roles at the selected clinic, e.g. NURSE.' })
	@IsOptional()
	@IsEnum(StaffRole, { each: true })
	@ArrayUnique()
	staffRoles?: StaffRole[];
}
