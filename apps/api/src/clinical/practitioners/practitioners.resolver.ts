import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { SaveMyPractitionerInput } from './dto/practitioner-profile.input.js';
import { Practitioner } from './models/practitioner.model.js';
import { PractitionerService } from './practitioner.service.js';

/** Practitioner profiles: your own (Settings → Account), and who holds clinic at a clinic. */
@Resolver(() => Practitioner)
export class PractitionersResolver {
	constructor(private readonly practitioners: PractitionerService) {}

	@Query(() => Practitioner, {
		nullable: true,
		description: 'Your practitioner profile (PRC license, PTR, S2 …); null until you add one.',
	})
	myPractitioner(@CurrentUser() user: AuthUser): Promise<Practitioner | null> {
		return this.practitioners.myPractitioner(user.id);
	}

	@Query(() => [Practitioner], { description: 'The practitioners holding clinic at a clinic, by name.' })
	clinicPractitioners(
		@CurrentUser() user: AuthUser,
		@Args('clinicId', { type: () => ID }) clinicId: string,
	): Promise<Practitioner[]> {
		return this.practitioners.listAtClinic(user.id, clinicId);
	}

	@Mutation(() => Practitioner, { description: 'Creates or updates your practitioner profile.' })
	saveMyPractitioner(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SaveMyPractitionerInput,
	): Promise<Practitioner> {
		return this.practitioners.saveMine(user.id, input);
	}
}
