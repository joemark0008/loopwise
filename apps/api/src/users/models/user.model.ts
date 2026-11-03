import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;

	@Field()
	email: string;

	@Field(() => String, { nullable: true })
	image: string | null;

	@Field()
	emailVerified: boolean;

	@Field({ description: 'Set for invited users until they choose their own password.' })
	requiresPasswordReset: boolean;

	@Field({ description: 'Whether the account is active (not deactivated by an admin).' })
	isActive: boolean;

	@Field()
	createdAt: Date;
}
