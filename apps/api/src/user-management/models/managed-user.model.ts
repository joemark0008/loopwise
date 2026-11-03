import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

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

	@Field({ description: 'Organization role: admin, user or viewer. Projects fall back to it.' })
	role: string;

	@Field(() => ManagedUserStatus)
	status: ManagedUserStatus;

	@Field()
	createdAt: Date;
}
