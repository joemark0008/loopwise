import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess, ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../clinic-admin-actor.js';
import { ClinicProfileService } from './clinic-profile.service.js';
import { UpdateClinicProfileInput, UpdateOrganizationProfileInput } from './dto/clinic-profile.input.js';
import { ClinicSetupProfile } from './models/clinic-profile.model.js';

/** Settings → Clinic → Profile: the organization's legal details and the selected clinic's registrations. */
@Resolver(() => ClinicSetupProfile)
export class ClinicProfileResolver {
	constructor(private readonly profiles: ClinicProfileService) {}

	@ClinicAccess()
	@Query(() => ClinicSetupProfile, { description: "The selected clinic's profile and its organization's." })
	clinicProfile(@CurrentClinicActor() actor: ClinicActor): Promise<ClinicSetupProfile> {
		return this.profiles.getProfile(actor);
	}

	@ClinicAdmin()
	@Mutation(() => ClinicSetupProfile, {
		description: "Updates the organization's legal details (its ADMIN or a SUPER_ADMIN; audited).",
	})
	updateOrganizationProfile(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: UpdateOrganizationProfileInput,
	): Promise<ClinicSetupProfile> {
		return this.profiles.updateOrganization(actor, input);
	}

	@ClinicAdmin()
	@Mutation(() => ClinicSetupProfile, {
		description: "Updates the selected clinic's profile (clinic admins; audited).",
	})
	updateClinicProfile(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: UpdateClinicProfileInput,
	): Promise<ClinicSetupProfile> {
		return this.profiles.updateClinic(actor, input);
	}
}
