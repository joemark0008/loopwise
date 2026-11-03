import { Field, ID, InputType, Int } from '@nestjs/graphql';

/** Inputs of the usage API; `UsageService` validates them with upstream's zod schemas (`usage.types.ts`). */
@InputType()
export class UsagePeriodRangeInput {
	@Field(() => Int)
	value: number;

	@Field({ description: 'hour, day or month.' })
	unit: string;
}

@InputType()
export class UsageFilterInput {
	@Field(() => UsagePeriodRangeInput)
	period: UsagePeriodRangeInput;

	@Field({ nullable: true, description: 'hour, day or month; defaults to the coarsest that fits the chart.' })
	granularity?: string;

	@Field({ nullable: true })
	provider?: string;

	@Field(() => [String], { nullable: true })
	userNames?: string[];

	@Field(() => [String], { nullable: true, description: 'Message sources (web, admin, contextRecommendations…).' })
	sources?: string[];
}

@InputType()
export class UsagePeriodSelectionInput {
	@Field({ description: '24h, 15d, 6m or saved.' })
	mode: string;

	@Field({ nullable: true })
	savedPeriodId?: string;
}

@InputType()
export class SavedUsagePeriodInput {
	@Field(() => Int)
	days: number;

	@Field({ description: 'hour, day or month.' })
	granularity: string;
}

@InputType()
export class UpdateSavedUsagePeriodInput extends SavedUsagePeriodInput {
	@Field(() => ID)
	id: string;
}
