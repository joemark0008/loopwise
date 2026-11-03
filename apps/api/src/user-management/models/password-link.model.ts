import { Field, ObjectType } from '@nestjs/graphql';

import { ManagedUser } from './managed-user.model.js';

@ObjectType({ description: 'A one-time link the admin hands to a user so they can choose a password.' })
export class PasswordLink {
	@Field(() => ManagedUser)
	user: ManagedUser;

	@Field({ description: 'Shown once: only a hash of its token is stored.' })
	url: string;

	@Field()
	expiresAt: Date;
}

@ObjectType({ description: 'What the set-password page shows about a valid link.' })
export class PasswordLinkInfo {
	@Field()
	name: string;

	@Field()
	email: string;

	@Field({ description: 'True for a new account (first password), false for a reset.' })
	isInvite: boolean;
}
