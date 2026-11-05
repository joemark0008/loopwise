import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser } from '../../../common/decorators/current.decorator.js';
import type { Clinic } from '../../../generated/prisma/client.js';
import { PractitionerAvailability } from './models/practitioner-availability.model.js';
import { PractitionerScheduleService } from './practitioner-schedule.service.js';

/** When a practitioner holds clinic: the day's sessions and slots, for the staff of the selected clinic. */
@Resolver(() => PractitionerAvailability)
export class PractitionerScheduleResolver {
	constructor(private readonly schedules: PractitionerScheduleService) {}

	@ClinicAccess()
	@Query(() => PractitionerAvailability, {
		description: "A practitioner's sessions and free slots at the selected clinic on a date (YYYY-MM-DD).",
	})
	practitionerAvailability(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('practitionerId', { type: () => ID }) practitionerId: string,
		@Args('date') date: string,
	): Promise<PractitionerAvailability> {
		return this.schedules.availabilityForUser(user.id, practitionerId, clinic.id, date);
	}
}
