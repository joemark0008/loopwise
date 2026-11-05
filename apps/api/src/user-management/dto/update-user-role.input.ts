import { Field, ID, InputType } from '@nestjs/graphql';
import { ArrayUnique, IsEnum, IsIn, IsUUID } from 'class-validator';

import { StaffRole } from '../../clinical/clinics/clinics/models/clinic-enums.js';
import { ORG_ACCESS_LEVELS, type OrgAccessLevel } from './create-user.input.js';

@InputType()
export class UpdateUserRoleInput {
	@Field(() => ID)
	@IsUUID()
	userId: string;

	@Field(() => String, { description: 'Organization access level: admin, user or viewer.' })
	@IsIn(ORG_ACCESS_LEVELS)
	role: OrgAccessLevel;
}

@InputType()
export class SetUserStaffRolesInput {
	@Field(() => ID)
	@IsUUID()
	userId: string;

	@Field(() => [StaffRole], { description: 'Every role the user holds at the selected clinic; empty removes them.' })
	@IsEnum(StaffRole, { each: true })
	@ArrayUnique()
	staffRoles: StaffRole[];
}
