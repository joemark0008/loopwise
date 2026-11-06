import { Args, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { FollowUpsInput } from './dto/follow-ups.input.js';
import { FollowUpService } from './follow-up.service.js';
import { FollowUp } from './models/follow-up.model.js';

/** The follow-up list. The service checks the desk (doctor, front desk, clinic admin); row-level security the rest. */
@Resolver(() => FollowUp)
export class FollowUpsResolver {
	constructor(private readonly service: FollowUpService) {}

	@Query(() => [FollowUp], {
		description:
			"Follow-ups overdue, due today or within `withinDays` at the clinic: a doctor's own, or the clinic's (front desk, admins).",
	})
	followUps(@CurrentUser() user: AuthUser, @Args('input') input: FollowUpsInput): Promise<FollowUp[]> {
		return this.service.list(user.id, input);
	}
}
