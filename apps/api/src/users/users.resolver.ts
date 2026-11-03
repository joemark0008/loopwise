import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthSession, AuthUser } from '../auth/auth.service.js';
import { CurrentSession, CurrentUser } from '../common/decorators/current.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ChangePasswordInput } from './dto/change-password.input.js';
import { ModifyPasswordInput } from './dto/modify-password.input.js';
import { UpdateProfileInput } from './dto/update-profile.input.js';
import { UpdateUserPreferencesInput } from './dto/update-user-preferences.input.js';
import { User } from './models/user.model.js';
import { UsersService } from './users.service.js';

@Resolver(() => User)
export class UsersResolver {
	constructor(private readonly users: UsersService) {}

	@Public()
	@Query(() => Boolean, {
		description: 'Whether any user exists yet (when none does, the app sends visitors to the /setup wizard).',
	})
	hasUsers(): Promise<boolean> {
		return this.users.hasUsers();
	}

	@Query(() => User, { description: 'The signed-in user.' })
	me(@CurrentUser() user: AuthUser): Promise<User> {
		return this.users.getUser(user.id);
	}

	@Mutation(() => User)
	updateProfile(@CurrentUser() user: AuthUser, @Args('input') input: UpdateProfileInput): Promise<User> {
		return this.users.updateProfile(user.id, input.name);
	}

	@Mutation(() => Boolean)
	async modifyPassword(@CurrentUser() user: AuthUser, @Args('input') input: ModifyPasswordInput): Promise<boolean> {
		await this.users.modifyPassword(user.id, input.newPassword, input.confirmPassword);
		return true;
	}

	@Mutation(() => Boolean, {
		description: 'Changes your own password (needs the current one) and signs out your other sessions.',
	})
	async changePassword(
		@CurrentUser() user: AuthUser,
		@CurrentSession() session: AuthSession['session'],
		@Args('input') input: ChangePasswordInput,
	): Promise<boolean> {
		await this.users.changePassword(user.id, session.id, input.currentPassword, input.newPassword);
		return true;
	}

	@Query(() => GraphQLJSON, { description: "The signed-in user's preferences (upstream `user.getPreferences`)." })
	userPreferences(@CurrentUser() user: AuthUser) {
		return this.users.getPreferences(user.id);
	}

	@Mutation(() => GraphQLJSON, { description: 'Upstream `user.updatePreferences`.' })
	updateUserPreferences(@CurrentUser() user: AuthUser, @Args('input') input: UpdateUserPreferencesInput) {
		return this.users.updatePreferences(user.id, input);
	}
}
