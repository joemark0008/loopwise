import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { Loaders } from '../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { UserLoader } from '../../users/user.loader.js';
import { Facility } from '../patients/models/patient.model.js';
import { FacilityLoader } from '../patients/patient.loader.js';
import { CreateEncounterInput } from './dto/encounter.input.js';
import { EncounterService } from './encounter.service.js';
import { Encounter, EncounterDoctor } from './models/encounter.model.js';

/** A patient's encounters. Access is row-level security plus the facility check in `EncounterService`. */
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

	@Mutation(() => Encounter)
	createEncounter(@CurrentUser() user: AuthUser, @Args('input') input: CreateEncounterInput): Promise<Encounter> {
		return this.service.create(user.id, input);
	}

	@ResolveField(() => Facility, { nullable: true })
	facility(@Parent() encounter: Encounter, @Loaders() loaders: RequestLoaders): Promise<Facility | null> {
		return loaders.get(FacilityLoader).load(encounter.orgId);
	}

	@ResolveField(() => EncounterDoctor, { nullable: true })
	async doctor(@Parent() encounter: Encounter, @Loaders() loaders: RequestLoaders): Promise<EncounterDoctor | null> {
		const user = await loaders.get(UserLoader).load(encounter.doctorId);
		return user && { id: user.id, name: user.name };
	}
}
