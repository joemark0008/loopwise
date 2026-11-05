import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { Loaders } from '../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { ClinicRef } from '../patients/models/clinic-ref.model.js';
import { ClinicRefLoader } from '../patients/patient.loader.js';
import { Practitioner } from '../practitioners/models/practitioner.model.js';
import { PractitionerLoader } from '../practitioners/practitioner.loader.js';
import { ClinicEncountersInput, CreateEncounterInput, TransitionEncounterInput } from './dto/encounter.input.js';
import { EncounterService } from './encounter.service.js';
import { Encounter } from './models/encounter.model.js';

/** A patient's visits and a clinic's queue. Access is row-level security plus the clinic checks. */
@Resolver(() => Encounter)
export class EncountersResolver {
	constructor(private readonly service: EncounterService) {}

	@Query(() => [Encounter], { description: "The patient's encounters, newest first (empty if not in your care)." })
	encounters(
		@CurrentUser() user: AuthUser,
		@Args('patientId', { type: () => ID }) patientId: string,
	): Promise<Encounter[]> {
		return this.service.list(user.id, patientId);
	}

	@Query(() => [Encounter], { description: 'The visits at one of your clinics, oldest first (the queue).' })
	clinicEncounters(@CurrentUser() user: AuthUser, @Args('input') input: ClinicEncountersInput): Promise<Encounter[]> {
		return this.service.listAtClinic(user.id, input);
	}

	@Mutation(() => Encounter, { description: 'Opens a visit at one of your clinics.' })
	createEncounter(@CurrentUser() user: AuthUser, @Args('input') input: CreateEncounterInput): Promise<Encounter> {
		return this.service.create(user.id, input);
	}

	@Mutation(() => Encounter, { description: 'Moves a visit to its next status (EncounterStatus).' })
	transitionEncounter(
		@CurrentUser() user: AuthUser,
		@Args('input') input: TransitionEncounterInput,
	): Promise<Encounter> {
		return this.service.transition(user.id, input);
	}

	@ResolveField(() => ClinicRef, { nullable: true })
	clinic(@Parent() encounter: Encounter, @Loaders() loaders: RequestLoaders): Promise<ClinicRef | null> {
		return loaders.get(ClinicRefLoader).load(encounter.clinicId);
	}

	@ResolveField(() => Practitioner, { nullable: true, description: 'The doctor of the visit.' })
	practitioner(@Parent() encounter: Encounter, @Loaders() loaders: RequestLoaders): Promise<Practitioner | null> {
		return encounter.practitionerId
			? loaders.get(PractitionerLoader).load(encounter.practitionerId)
			: Promise.resolve(null);
	}
}
