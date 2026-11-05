import type { UserRole } from '@loopwise/shared/types';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicAdmin, ClinicNonViewer } from '../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
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
 * Settings → Usage. Viewers have no access; clinic admins see the whole clinic, other members their own usage.
 * The period settings are the caller's own, per clinic (`clinicId` selects it, like the `x-loopwise-clinic-id`
 * header).
 */
@Resolver()
export class UsageResolver {
	constructor(private readonly usage: UsageService) {}

	@ClinicNonViewer()
	@Query(() => [UsageRecord], { description: 'Messages, tokens and cost per chart bucket.' })
	usageMessages(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<UsageRecord[]> {
		return this.usage.getMessagesUsage(clinic.id, { userId: user.id, role }, filter);
	}

	@ClinicNonViewer()
	@Query(() => [UsageByUserRecord], { description: 'Messages, tokens and cost per user and chart bucket.' })
	usageByUser(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<UsageByUserRecord[]> {
		return this.usage.getMessagesUsageByUser(clinic.id, { userId: user.id, role }, filter);
	}

	@ClinicNonViewer()
	@Query(() => TotalUsage)
	usageTotal(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() role: UserRole,
		@Args('filter') filter: UsageFilterInput,
	): Promise<TotalUsage> {
		return this.usage.getTotalUsage(clinic.id, { userId: user.id, role }, filter);
	}

	@ClinicNonViewer()
	@Query(() => [String], { description: 'Providers that appear in the usage.' })
	usageProviders(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() role: UserRole,
	): Promise<string[]> {
		return this.usage.getUsedProviders(clinic.id, { userId: user.id, role });
	}

	@ClinicAdmin()
	@Query(() => [UsageUserFacet], { description: 'Users with chats in the clinic and their chat count.' })
	usageUserFacets(@CurrentClinic() clinic: Clinic): Promise<UsageUserFacet[]> {
		return this.usage.getUserChatCounts(clinic.id);
	}

	@ClinicNonViewer()
	@Query(() => UsagePeriodSettings)
	usagePeriodSettings(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
	): Promise<UsagePeriodSettings> {
		return this.usage.getPeriodSettings(user.id, clinic.id);
	}

	@ClinicNonViewer()
	@Mutation(() => UsagePeriodSelection, { nullable: true })
	updateUsagePeriodSelection(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
		@Args('selection') selection: UsagePeriodSelectionInput,
	): Promise<UsagePeriodSelection | null> {
		return this.usage.updatePeriodSelection(user.id, clinic.id, selection);
	}

	@ClinicNonViewer()
	@Mutation(() => SavedUsagePeriod, { description: 'Saves a period and selects it.' })
	createSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
		@Args('savedPeriod') savedPeriod: SavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		return this.usage.createSavedPeriod(user.id, clinic.id, savedPeriod);
	}

	@ClinicNonViewer()
	@Mutation(() => SavedUsagePeriod)
	updateSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
		@Args('savedPeriod') savedPeriod: UpdateSavedUsagePeriodInput,
	): Promise<SavedUsagePeriod> {
		return this.usage.updateSavedPeriod(user.id, clinic.id, savedPeriod);
	}

	@ClinicNonViewer()
	@Mutation(() => DeletedSavedUsagePeriod)
	deleteSavedUsagePeriod(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
		@Args('id', { type: () => ID }) id: string,
	): Promise<DeletedSavedUsagePeriod> {
		return this.usage.deleteSavedPeriod(user.id, clinic.id, id);
	}
}
