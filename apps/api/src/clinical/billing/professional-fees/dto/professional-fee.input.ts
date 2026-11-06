import { Field, ID, InputType } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

import { PfStatus } from '../../billing.enums.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@InputType()
export class ProfessionalFeeReportInput {
	@Field({ description: 'First day (YYYY-MM-DD, Manila).' })
	@Matches(DATE)
	from: string;

	@Field(() => String, { nullable: true, description: 'Last day; default `from`.' })
	@IsOptional()
	@Matches(DATE)
	to?: string | null;

	@Field(() => ID, { nullable: true, description: 'One doctor.' })
	@IsOptional()
	@IsUUID()
	practitionerId?: string | null;

	@Field(() => PfStatus, { nullable: true })
	@IsOptional()
	@IsIn(Object.values(PfStatus))
	status?: PfStatus | null;
}

@InputType()
export class ReleaseProfessionalFeesInput {
	@Field(() => [ID])
	@ArrayMinSize(1)
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	ids: string[];

	@Field({ description: 'The check number or bank transfer reference of the payout.' })
	@IsString()
	@MaxLength(80)
	releaseRef: string;
}
