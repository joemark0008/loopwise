import type { UserRole } from '@loopwise/shared/types';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectAdmin, ProjectNonViewer } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import {
	SavedUsagePeriodInput,
	UpdateSavedUsagePeriodInput,
	UsageFilterInput,
	UsagePeriodSelectionInput,
} from './dto/usage.input.js';
import {
	DeletedSavedUsagePeriod,
	SavedUsagePeriod,
	TotalUsage,
	UsageByUserRecord,
	UsagePeriodSelection,
	UsagePeriodSettings,
	UsageRecord,
	UsageUserFacet,
} from './models/usage.model.js';
import { UsageService } from './usage.service.js';

/**
 * Settings → Usage. Viewers have no access; project admins see the whole project, other members their own usage.
 * The period settings are the caller's own, per project (`projectId` selects it, like the `x-loopwise-project-id`
 * header).
 */
@Resolver()
export class UsageResolver {
	constructor(private readonly usage: UsageService) {}

	@ProjectNonViewer()
	@Query(() => [UsageRecord], { description: 'Messages, tokens and cost per chart bucket.' })
	usageMessages(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<UsageRecord[]> {
		return this.usage.getMessagesUsage(project.id, { userId: user.id, role }, filter);
	}

	@ProjectNonViewer()
	@Query(() => [UsageByUserRecord], { description: 'Messages, tokens and cost per user and chart bucket.' })
	usageByUser(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<UsageByUserRecord[]> {
		return this.usage.getMessagesUsageByUser(project.id, { userId: user.id, role }, filter);
	}

	@ProjectNonViewer()
	@Query(() => TotalUsage)
	usageTotal(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<TotalUsage> {
		return this.usage.getTotalUsage(project.id, { userId: user.id, role }, filter);
	}

	@ProjectNonViewer()
	@Query(() => [String], { description: 'Providers that appear in the usage.' })
	usageProviders(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@CurrentUserRole() role: UserRole,
	): Promise<string[]> {
		return this.usage.getUsedProviders(project.id, { userId: user.id, role });
	}

	@ProjectAdmin()
	@Query(() => [UsageUserFacet], { description: 'Users with chats in the project and their chat count.' })
	usageUserFacets(@CurrentProject() project: Project): Promise<UsageUserFacet[]> {
		return this.usage.getUserChatCounts(project.id);
	}

	@ProjectNonViewer()
	@Query(() => UsagePeriodSettings)
	usagePeriodSettings(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
	): Promise<UsagePeriodSettings> {
		return this.usage.getPeriodSettings(user.id, project.id);
	}

	@ProjectNonViewer()
	@Mutation(() => UsagePeriodSelection, { nullable: true })
	updateUsagePeriodSelection(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
		@Args('selection') selection: UsagePeriodSelectionInput,
	): Promise<UsagePeriodSelection | null> {
		return this.usage.updatePeriodSelection(user.id, project.id, selection);
	}

	@ProjectNonViewer()
	@Mutation(() => SavedUsagePeriod, { description: 'Saves a period and selects it.' })
	createSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
		@Args('savedPeriod') savedPeriod: SavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		return this.usage.createSavedPeriod(user.id, project.id, savedPeriod);
	}

	@ProjectNonViewer()
	@Mutation(() => SavedUsagePeriod)
	updateSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
		@Args('savedPeriod') savedPeriod: UpdateSavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		return this.usage.updateSavedPeriod(user.id, project.id, savedPeriod);
	}

	@ProjectNonViewer()
	@Mutation(() => DeletedSavedUsagePeriod)
	deleteSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentProject() project: Project,
		@Args('projectId', { type: () => ID }) _projectId: string,
		@Args('id', { type: () => ID }) id: string,
	): Promise<DeletedSavedUsagePeriod> {
		return this.usage.deleteSavedPeriod(user.id, project.id, id);
	}
}
