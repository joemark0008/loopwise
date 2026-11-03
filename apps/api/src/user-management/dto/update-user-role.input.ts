import { Field, ID, InputType } from '@nestjs/graphql';
import { IsIn, IsString } from 'class-validator';

import { ORG_ROLES, type OrgRole } from '../../organizations/organization.repository.js';

@InputType()
export class UpdateUserRoleInput {
	@Field(() => ID)
	@IsString()
	userId: string;

	@Field(() => String, { description: 'admin, user or viewer.' })
	@IsIn(ORG_ROLES)
	role: OrgRole;
}
