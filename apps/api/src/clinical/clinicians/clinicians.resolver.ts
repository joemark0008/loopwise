import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { ClinicianService } from './clinician.service.js';
import { UpdateClinicianProfileInput } from './dto/clinician-profile.input.js';
import { ClinicianProfile } from './models/clinician-profile.model.js';

@Resolver(() => ClinicianProfile)
export class CliniciansResolver {
	constructor(private readonly service: ClinicianService) {}

	@Query(() => ClinicianProfile, { description: 'Your PRC license, PTR and credentials (empty until set).' })
	myClinicianProfile(@CurrentUser() user: AuthUser): Promise<ClinicianProfile> {
		return this.service.myProfile(user.id);
	}

	@Mutation(() => ClinicianProfile)
	updateMyClinicianProfile(
		@CurrentUser() user: AuthUser,
		@Args('input') input: UpdateClinicianProfileInput,
	): Promise<ClinicianProfile> {
		return this.service.updateMyProfile(user.id, input);
	}
}
