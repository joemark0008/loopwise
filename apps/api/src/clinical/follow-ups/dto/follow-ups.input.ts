import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { MAX_OVERDUE_DAYS, MAX_WITHIN_DAYS } from '../follow-up-window.js';

@InputType()
export class FollowUpsInput {
	@Field(() => ID)
	@IsUUID()
	clinicId: string;

	@Field(() => ID, {
		nullable: true,
		description: "One doctor's follow-ups (front desk, admins). A doctor always gets their own.",
	})
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field(() => Int, { nullable: true, description: `Days ahead to include (default 7, at most ${MAX_WITHIN_DAYS}).` })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(MAX_WITHIN_DAYS)
	withinDays?: number | null;

	@Field(() => Int, {
		nullable: true,
		description: `How far back overdue ones still show (default 180 days, at most ${MAX_OVERDUE_DAYS}).`,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(MAX_OVERDUE_DAYS)
	overdueDays?: number | null;
}
