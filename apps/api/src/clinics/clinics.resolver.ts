import type { UserRole } from '@loopwise/shared/types';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicAccess, ClinicAdmin } from '../common/decorators/access.decorator.js';
import {
	CurrentClinic,
	CurrentStaffRoles,
	CurrentUser,
	CurrentUserRole,
	SelectedClinicId,
} from '../common/decorators/current.decorator.js';
import type { Clinic, StaffRole } from '../generated/prisma/client.js';
import { ClinicsService } from './clinics.service.js';
import { CreateClinicInput, RenameClinicInput, SavedPromptInput, UpdateSavedPromptInput } from './dto/clinic.input.js';
import { ClinicSummary, DatabaseObject, SavedPrompt } from './models/clinic.model.js';

@Resolver(() => ClinicSummary)
export class ClinicsResolver {
	constructor(private readonly clinicsService: ClinicsService) {}

	@Query(() => [ClinicSummary], { description: 'Clinics the signed-in user can access.' })
	clinics(@CurrentUser() user: AuthUser): Promise<ClinicSummary[]> {
		return this.clinicsService.listForUser(user.id);
	}

	@Query(() => ClinicSummary, { nullable: true, description: 'The selected clinic (`x-loopwise-clinic-id`).' })
	currentClinic(
		@CurrentUser() user: AuthUser,
		@SelectedClinicId() selectedClinicId: string | null,
	): Promise<ClinicSummary | null> {
		return this.clinicsService.getCurrent(user.id, selectedClinicId);
	}

	@Mutation(() => ClinicSummary)
	createClinic(
		@CurrentUser() user: AuthUser,
		@SelectedClinicId() selectedClinicId: string | null,
		@Args('input') input: CreateClinicInput,
	): Promise<ClinicSummary> {
		return this.clinicsService.createClinic(user.id, selectedClinicId, input.name);
	}

	@ClinicAdmin()
	@Mutation(() => ClinicSummary)
	renameClinic(
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() userRole: UserRole,
		@CurrentStaffRoles() staffRoles: StaffRole[],
		@Args('input') input: RenameClinicInput,
	): Promise<ClinicSummary> {
		return this.clinicsService.renameClinic({ clinic, userRole, staffRoles }, input.clinicId, input.name);
	}

	@ClinicAdmin()
	@Mutation(() => Boolean)
	async deleteClinic(
		@CurrentClinic() clinic: Clinic,
		@Args('clinicId', { type: () => ID }) _clinicId: string,
	): Promise<boolean> {
		await this.clinicsService.deleteClinic(clinic);
		return true;
	}

	@ClinicAccess()
	@Query(() => [SavedPrompt])
	savedPrompts(@CurrentClinic() clinic: Clinic): Promise<SavedPrompt[]> {
		return this.clinicsService.listSavedPrompts(clinic.id);
	}

	@Query(() => [SavedPrompt], { description: "A clinic's saved prompts; empty when the user is not in it." })
	clinicSavedPrompts(
		@CurrentUser() user: AuthUser,
		@Args('clinicId', { type: () => ID }) clinicId: string,
	): Promise<SavedPrompt[]> {
		return this.clinicsService.listClinicSavedPromptsForUser(clinicId, user.id);
	}

	@ClinicAdmin()
	@Mutation(() => SavedPrompt)
	createSavedPrompt(@CurrentClinic() clinic: Clinic, @Args('input') input: SavedPromptInput): Promise<SavedPrompt> {
		return this.clinicsService.createSavedPrompt(clinic.id, input.title, input.prompt);
	}

	@ClinicAdmin()
	@Mutation(() => SavedPrompt)
	updateSavedPrompt(
		@CurrentClinic() clinic: Clinic,
		@Args('input') input: UpdateSavedPromptInput,
	): Promise<SavedPrompt> {
		return this.clinicsService.updateSavedPrompt(clinic.id, input.promptId, {
			title: input.title,
			prompt: input.prompt,
		});
	}

	@ClinicAdmin()
	@Mutation(() => Boolean)
	async deleteSavedPrompt(
		@CurrentClinic() clinic: Clinic,
		@Args('promptId', { type: () => ID }) promptId: string,
	): Promise<boolean> {
		await this.clinicsService.deleteSavedPrompt(clinic.id, promptId);
		return true;
	}

	@ClinicAccess()
	@Query(() => [DatabaseObject], { description: 'Synced warehouse tables of the selected clinic (`@` mentions).' })
	databaseObjects(@CurrentClinic() clinic: Clinic): DatabaseObject[] {
		return this.clinicsService.listDatabaseObjects(clinic);
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `clinic.getDisplaySettings`: the date format.' })
	displaySettings(@CurrentClinic() clinic: Clinic) {
		return this.clinicsService.getDisplaySettings(clinic.id);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.updateDisplaySettings`.' })
	updateDisplaySettings(@CurrentClinic() clinic: Clinic, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.clinicsService.updateDisplaySettings(clinic.id, input);
	}
}
