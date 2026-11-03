import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/auth.service.js';
import { OrgAdmin, OrgMember } from '../common/decorators/access.decorator.js';
import { CurrentOrganization, CurrentOrgRole, CurrentUser } from '../common/decorators/current.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { Organization } from '../generated/prisma/client.js';
import { CreateUserInput } from './dto/create-user.input.js';
import { SetPasswordWithLinkInput } from './dto/set-password-with-link.input.js';
import { UpdateUserRoleInput } from './dto/update-user-role.input.js';
import { ManagedUser } from './models/managed-user.model.js';
import { PasswordLink, PasswordLinkInfo } from './models/password-link.model.js';
import { UserManagementService } from './user-management.service.js';

@Resolver()
export class UserManagementResolver {
	constructor(private readonly userManagement: UserManagementService) {}

	@OrgMember()
	@Query(() => String, { description: "The signed-in user's organization role: admin, user or viewer." })
	currentOrgRole(@CurrentOrgRole() role: string): string {
		return role;
	}

	@OrgAdmin({ strict: true })
	@Query(() => [ManagedUser], { description: 'Every user of the organization (admins only).' })
	managedUsers(@CurrentOrganization() org: Organization): Promise<ManagedUser[]> {
		return this.userManagement.listUsers(org.id);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => PasswordLink, { description: 'Creates a user and returns the link they set their password with.' })
	createUser(@CurrentOrganization() org: Organization, @Args('input') input: CreateUserInput): Promise<PasswordLink> {
		return this.userManagement.createUser(org.id, input);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => PasswordLink, {
		description:
			"A new set-password link for the user (an invite or a reset); the user's earlier links stop working.",
	})
	createPasswordLink(
		@CurrentOrganization() org: Organization,
		@Args('userId', { type: () => ID }) userId: string,
	): Promise<PasswordLink> {
		return this.userManagement.createPasswordLink(org.id, userId);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => ManagedUser)
	updateUserRole(
		@CurrentOrganization() org: Organization,
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateUserRoleInput,
	): Promise<ManagedUser> {
		return this.userManagement.updateRole(org.id, user.id, input.userId, input.role);
	}

	@OrgAdmin({ strict: true })
	@Mutation(() => ManagedUser, { description: 'Deactivating signs the user out and voids their password links.' })
	setUserActive(
		@CurrentOrganization() org: Organization,
		@CurrentUser() user: AuthUser,
		@Args('userId', { type: () => ID }) userId: string,
		@Args('active') active: boolean,
	): Promise<ManagedUser> {
		return this.userManagement.setUserActive(org.id, user.id, userId, active);
	}

	@Public()
	@Query(() => PasswordLinkInfo, { nullable: true, description: 'Null when the link is invalid or expired.' })
	passwordLink(@Args('token') token: string): Promise<PasswordLinkInfo | null> {
		return this.userManagement.getPasswordLinkInfo(token);
	}

	@Public()
	@Mutation(() => String, { description: 'Sets the password from a link and returns the email to sign in with.' })
	setPasswordWithLink(@Args('input') input: SetPasswordWithLinkInput): Promise<string> {
		return this.userManagement.setPasswordWithLink(input.token, input.password);
	}
}
