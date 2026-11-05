import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { StaffRole } from '../../clinics/models/clinic-enums.js';

export enum ManagedUserStatus {
	/** Created by an admin; has not set a password through their link yet. */
	INVITED = 'INVITED',
	ACTIVE = 'ACTIVE',
	DEACTIVATED = 'DEACTIVATED',
}

registerEnumType(ManagedUserStatus, { name: 'ManagedUserStatus' });

@ObjectType({ description: 'A member of the organization, as the admin users page lists them.' })
export class ManagedUser {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	email: string;

	@Field({ description: 'Organization access level: admin, user or viewer. Clinics fall back to it.' })
	role: string;

	@Field(() => [StaffRole], {
		description: 'Roles at the selected clinic (empty when no clinic of the organization is selected).',
	})
	staffRoles: StaffRole[];

	@Field(() => ManagedUserStatus)
	status: ManagedUserStatus;

	@Field()
	createdAt: Date;
}
